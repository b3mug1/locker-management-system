from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_admin, get_current_user, get_db
from app.core.websocket import manager
from app.models.user import User
from app.models.student import Student
from app.models.locker import Locker
from app.models.assignment import Assignment
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AutoAssignRequest, AutoAssignResult
from app.services.assignment import AssignmentService
from app.services.student import StudentService
from app.services.locker import LockerService
from app.services.audit import AuditLogService
from app.services.notification import NotificationService
from app.services.email import send_assignment_email, send_release_email

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("/", response_model=list[AssignmentRead])
async def list_assignments(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = AssignmentService(db)
    return await service.get_all(skip=skip, limit=limit)


@router.get("/my", response_model=list[AssignmentRead])
async def my_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AssignmentService(db)
    return await service.get_by_user_email(current_user.email)


@router.get("/my-dashboard")
async def my_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rich user dashboard data: student profile, active locker details, assignment history."""
    from sqlalchemy import select, func
    from app.models.assignment import Assignment

    # Get linked student
    student = None
    if current_user.student_id:
        result = await db.execute(select(Student).where(Student.id == current_user.student_id))
        student = result.scalar_one_or_none()

    student_info = None
    if student:
        student_info = {
            "id": student.id,
            "full_name": student.full_name,
            "group": student.group,
            "barcode": student.barcode,
            "course": student.course,
        }

    # Get all assignments for this student
    assignments_data = []
    active_locker = None
    if student:
        result = await db.execute(
            select(Assignment)
            .where(Assignment.student_id == student.id)
            .order_by(Assignment.id.desc())
        )
        all_assignments = list(result.scalars().all())

        for a in all_assignments:
            entry = {
                "id": a.id,
                "locker_number": a.locker.number if a.locker else None,
                "locker_floor": a.locker.floor if a.locker else None,
                "locker_size": a.locker.size if a.locker else None,
                "locker_access_type": a.locker.access_type if a.locker else None,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                "released_at": a.released_at.isoformat() if a.released_at else None,
            }
            assignments_data.append(entry)

            if not a.released_at and a.locker:
                # Get occupied count for this locker
                occ_result = await db.execute(
                    select(func.count(Assignment.id)).where(
                        Assignment.locker_id == a.locker_id,
                        Assignment.released_at.is_(None),
                    )
                )
                occupied = occ_result.scalar_one()
                active_locker = {
                    "number": a.locker.number,
                    "floor": a.locker.floor,
                    "size": a.locker.size,
                    "access_type": a.locker.access_type,
                    "capacity": a.locker.capacity,
                    "occupied": occupied,
                    "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                }

    # Duration stats
    total_assignments = len(assignments_data)
    active_count = sum(1 for a in assignments_data if not a["released_at"])

    return {
        "email": current_user.email,
        "role": current_user.role,
        "student": student_info,
        "active_locker": active_locker,
        "assignments": assignments_data,
        "total_assignments": total_assignments,
        "active_count": active_count,
    }


@router.get("/active-count")
async def active_count(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = AssignmentService(db)
    count = await service.count_active()
    return {"count": count}


@router.post("/", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
async def assign_locker(
    data: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = AssignmentService(db)
    assignment = await service.assign(data)
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="assign",
        entity_type="assignment",
        entity_id=assignment.id,
        summary=f"Assigned locker {assignment.locker.number if assignment.locker else assignment.locker_id} to {assignment.student.full_name if assignment.student else assignment.student_id}",
    )
    student_user = (await db.execute(select(User).where(User.student_id == assignment.student_id))).scalar_one_or_none()
    if student_user:
        await NotificationService(db).create(
            user_id=student_user.id,
            title="Locker assigned",
            message=f"Locker {assignment.locker.number} on floor {assignment.locker.floor} has been assigned to you.",
            type="success",
        )
        try:
            send_assignment_email(student_user.email, assignment.locker.number, assignment.locker.floor)
        except Exception:
            pass
    await manager.broadcast("assignment_change")
    await manager.broadcast("locker_change")
    return AssignmentRead(
        id=assignment.id,
        student_id=assignment.student_id,
        locker_id=assignment.locker_id,
        assigned_at=assignment.assigned_at,
        released_at=assignment.released_at,
        student_name=assignment.student.full_name if assignment.student else None,
        locker_number=assignment.locker.number if assignment.locker else None,
    )


@router.post("/{assignment_id}/release", response_model=AssignmentRead)
async def release_locker(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = AssignmentService(db)
    assignment = await service.release(assignment_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="release",
        entity_type="assignment",
        entity_id=assignment.id,
        summary=f"Released locker {assignment.locker.number if assignment.locker else assignment.locker_id} from {assignment.student.full_name if assignment.student else assignment.student_id}",
    )
    student_user = (await db.execute(select(User).where(User.student_id == assignment.student_id))).scalar_one_or_none()
    if student_user:
        await NotificationService(db).create(
            user_id=student_user.id,
            title="Locker released",
            message=f"Locker {assignment.locker.number} has been released.",
            type="warning",
        )
        try:
            send_release_email(student_user.email, assignment.locker.number)
        except Exception:
            pass
    await manager.broadcast("assignment_change")
    await manager.broadcast("locker_change")
    return AssignmentRead(
        id=assignment.id,
        student_id=assignment.student_id,
        locker_id=assignment.locker_id,
        assigned_at=assignment.assigned_at,
        released_at=assignment.released_at,
        student_name=assignment.student.full_name if assignment.student else None,
        locker_number=assignment.locker.number if assignment.locker else None,
    )


@router.post("/release-all")
async def release_all_lockers(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Release all active locker assignments (e.g. end of semester)."""
    service = AssignmentService(db)
    active_assignments = list((await db.execute(
        select(Assignment)
        .options(selectinload(Assignment.locker))
        .where(Assignment.released_at.is_(None))
    )).scalars().all())
    released_count = await service.release_all()
    student_ids = [assignment.student_id for assignment in active_assignments]
    users_by_student_id = {}
    if student_ids:
        users = list((await db.execute(
            select(User).where(User.student_id.in_(student_ids))
        )).scalars().all())
        users_by_student_id = {user.student_id: user for user in users}

    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="release_all",
        entity_type="assignment",
        entity_id=None,
        summary=f"Released all active assignments ({released_count})",
        commit=False,
    )
    notification_service = NotificationService(db)
    for assignment in active_assignments:
        student_user = users_by_student_id.get(assignment.student_id)
        if not student_user or not assignment.locker:
            continue
        await notification_service.create(
            user_id=student_user.id,
            title="Locker released",
            message=f"Locker {assignment.locker.number} has been released.",
            type="warning",
            commit=False,
        )
        try:
            send_release_email(student_user.email, assignment.locker.number)
        except Exception:
            pass

    await db.commit()
    await manager.broadcast("assignment_change")
    await manager.broadcast("locker_change")
    return {"released": released_count}


@router.post("/auto-assign", response_model=AutoAssignResult)
async def auto_assign_lockers(
    data: AutoAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    active_student_ids = select(Assignment.student_id).where(Assignment.released_at.is_(None))
    students = list((await db.execute(
        select(Student)
        .where(~Student.id.in_(active_student_ids))
        .order_by(
            (Student.inclusive_status == "none").asc(),
            Student.course.desc(),
            Student.group.asc(),
            Student.full_name.asc(),
        )
    )).scalars().all())

    active_counts = {
        row.locker_id: row.count
        for row in (await db.execute(
            select(Assignment.locker_id, func.count(Assignment.id).label("count"))
            .where(Assignment.released_at.is_(None))
            .group_by(Assignment.locker_id)
        )).all()
    }
    lockers = list((await db.execute(
        select(Locker)
        .where(Locker.status == "active")
        .order_by(Locker.floor.asc(), Locker.size.desc(), Locker.number.asc())
    )).scalars().all())

    items = []
    remaining_by_locker = {locker.id: locker.capacity - active_counts.get(locker.id, 0) for locker in lockers}
    available_spots = sum(max(0, spots) for spots in remaining_by_locker.values())
    limit = data.max_assignments or len(students)

    for student in students:
        if len(items) >= limit:
            break
        candidates = [locker for locker in lockers if remaining_by_locker.get(locker.id, 0) > 0]
        if not candidates:
            break

        def score(locker: Locker) -> tuple:
            occupied = locker.capacity - remaining_by_locker[locker.id]
            same_group_bonus = 0
            if occupied > 0:
                same_group_bonus = -1
            priority_floor = locker.floor if student.inclusive_status != "none" else abs(locker.floor - student.course)
            return (priority_floor, same_group_bonus, occupied, locker.number)

        locker = sorted(candidates, key=score)[0]
        occupied_before = locker.capacity - remaining_by_locker[locker.id]
        remaining_by_locker[locker.id] -= 1
        items.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "student_group": student.group,
            "student_course": student.course,
            "inclusive_status": student.inclusive_status,
            "locker_id": locker.id,
            "locker_number": locker.number,
            "locker_floor": locker.floor,
            "locker_size": locker.size,
            "locker_capacity": locker.capacity,
            "locker_occupied_before": occupied_before,
        })

    created = 0
    if data.commit and items:
        for item in items:
            db.add(Assignment(student_id=item["student_id"], locker_id=item["locker_id"]))
            created += 1
        await db.flush()
        await AuditLogService(db).create(
            actor_id=current_admin.id,
            action="auto_assign",
            entity_type="assignment",
            entity_id=None,
            summary=f"Auto-assigned {created} students",
            new_values={"assignments": items},
            commit=False,
        )
        await db.commit()
        await manager.broadcast("assignment_change")
        await manager.broadcast("locker_change")

    return {
        "planned": len(items),
        "created": created,
        "skipped_students": max(0, len(students) - len(items)),
        "available_spots": available_spots,
        "items": items,
    }


@router.post("/import-combined-csv")
async def import_combined_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Import combined CSV: each row has student + locker + assignment data.
    Expected columns: full_name, barcode, group, course, locker_number, size, floor, access_type
    """
    from app.schemas.locker import LOCKER_RULES
    from app.models.assignment import Assignment as AssignmentModel
    from sqlalchemy import select as sa_select

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created_students = 0
    created_lockers = 0
    created_assignments = 0
    skipped = 0
    errors = []

    student_service = StudentService(db)
    locker_service = LockerService(db)
    assignment_service = AssignmentService(db)

    for i, row in enumerate(reader, start=2):
        row = {k.strip(): v.strip() for k, v in row.items() if k}
        full_name = row.get("full_name") or row.get("ФИО") or ""
        barcode = row.get("barcode") or row.get("Штрихкод") or ""
        group = row.get("group") or row.get("Группа") or ""
        course_str = row.get("course") or row.get("Курс") or "1"
        locker_number = row.get("locker_number") or row.get("Номер локера") or ""
        size = row.get("size") or row.get("Тип локера") or "medium"
        floor_str = row.get("floor") or row.get("Этаж") or "1"
        access_type = row.get("access_type") or row.get("Доступ") or ""

        if not full_name or not locker_number:
            errors.append(f"Row {i}: missing full_name or locker_number")
            skipped += 1
            continue

        # Normalize size
        size_map = {"маленький": "small", "средний": "medium", "большой": "large"}
        size = size_map.get(size.lower(), size.lower())
        if size not in LOCKER_RULES:
            size = "medium"

        # Determine access_type and capacity from rules
        if not access_type or access_type not in LOCKER_RULES.get(size, {}):
            access_type = list(LOCKER_RULES[size].keys())[0]
        capacity = LOCKER_RULES[size][access_type]

        try:
            course = int(course_str)
        except ValueError:
            course = 1

        try:
            floor = int(floor_str)
        except ValueError:
            floor = 1

        try:
            # 1. Get or create student
            existing_student = None
            if barcode:
                result = await db.execute(sa_select(Student).where(Student.barcode == barcode))
                existing_student = result.scalar_one_or_none()

            if existing_student:
                student = existing_student
            else:
                if not barcode or not group:
                    errors.append(f"Row {i}: missing barcode or group for student '{full_name}'")
                    skipped += 1
                    continue
                student = Student(full_name=full_name, barcode=barcode, group=group, course=course)
                db.add(student)
                await db.flush()
                created_students += 1

            # 2. Get or create locker
            existing_locker = await locker_service.get_by_number(locker_number)
            if existing_locker:
                locker = existing_locker
            else:
                locker = Locker(
                    number=locker_number, size=size, access_type=access_type,
                    capacity=capacity, floor=floor, status="active",
                )
                db.add(locker)
                await db.flush()
                created_lockers += 1

            # 3. Check if already assigned (active)
            active = await assignment_service.get_active_by_student(student.id)
            if active:
                skipped += 1
                continue

            # Check locker capacity
            occ = await locker_service.get_occupied_count(locker.id)
            if occ >= locker.capacity:
                errors.append(f"Row {i}: locker {locker_number} is full")
                skipped += 1
                continue

            assignment = AssignmentModel(student_id=student.id, locker_id=locker.id)
            db.add(assignment)
            await db.flush()
            created_assignments += 1

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    await db.commit()
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="import",
        entity_type="assignment",
        entity_id=None,
        summary=f"Imported combined CSV: {created_students} students, {created_lockers} lockers, {created_assignments} assignments",
    )
    await manager.broadcast("student_change")
    await manager.broadcast("locker_change")
    await manager.broadcast("assignment_change")

    return {
        "created_students": created_students,
        "created_lockers": created_lockers,
        "created_assignments": created_assignments,
        "skipped": skipped,
        "errors": errors[:20],
    }
