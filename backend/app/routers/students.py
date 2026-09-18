from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_db
from app.core.websocket import manager
from app.models.user import User
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate
from app.services.audit import AuditLogService
from app.services.student import StudentService

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("/", response_model=list[StudentRead])
async def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    return await service.get_all(skip=skip, limit=limit)


@router.get("/count")
async def count_students(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    count = await service.count()
    return {"count": count}


@router.get("/{student_id}", response_model=StudentRead)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    student = await service.get_by_id(student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.post("/", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
async def create_student(
    data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    student = await service.create(data, commit=False)
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="create",
        entity_type="student",
        entity_id=student.id,
        summary=f"Created student {student.full_name}",
        new_values=data.model_dump(),
    )
    await manager.broadcast("student_change")
    return student


@router.put("/{student_id}", response_model=StudentRead)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    existing = await service.get_by_id(student_id)
    old_values = None
    if existing:
        old_values = {
            "full_name": existing.full_name,
            "group": existing.group,
            "barcode": existing.barcode,
            "course": existing.course,
            "inclusive_status": existing.inclusive_status,
        }
    student = await service.update(student_id, data, commit=False)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="update",
        entity_type="student",
        entity_id=student.id,
        summary=f"Updated student {student.full_name}",
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True),
    )
    await manager.broadcast("student_change")
    return student


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    service = StudentService(db)
    existing = await service.get_by_id(student_id)
    deleted = await service.delete(student_id, commit=False)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="delete",
        entity_type="student",
        entity_id=student_id,
        summary=f"Deleted student {existing.full_name if existing else student_id}",
        old_values={
            "full_name": existing.full_name,
            "group": existing.group,
            "barcode": existing.barcode,
        } if existing else None,
    )
    await manager.broadcast("student_change")


@router.post("/import-csv")
async def import_students_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors: list[str] = []
    seen_barcodes: set[str] = set()
    service = StudentService(db)
    existing_result = await db.execute(select(Student.barcode))
    existing_barcodes = {barcode for (barcode,) in existing_result}

    for i, row in enumerate(reader, start=2):
        try:
            full_name = row.get("full_name", "").strip()
            barcode = row.get("barcode", "").strip()
            group = row.get("group", "").strip()

            if not full_name or not barcode or not group:
                errors.append(f"Row {i}: missing required field (full_name, barcode, group)")
                skipped += 1
                continue
            if barcode in seen_barcodes or barcode in existing_barcodes:
                errors.append(f"Row {i}: barcode '{barcode}' already exists")
                skipped += 1
                continue
            seen_barcodes.add(barcode)

            data = StudentCreate(
                full_name=full_name,
                group=group,
                barcode=barcode,
                course=int(row.get("course", 1)),
            )
            await service.create(data, commit=False, flush=False)
            created += 1
        except SQLAlchemyError as e:
            await db.rollback()
            errors.append(f"Row {i}: database error: {e}")
            skipped += 1
        except (ValueError, TypeError) as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    if created > 0:
        try:
            await db.commit()
        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(status_code=400, detail=f"Student import failed: {e}") from e
        await AuditLogService(db).create(
            actor_id=current_admin.id,
            action="import",
            entity_type="student",
            entity_id=None,
            summary=f"Imported students CSV: {created} created, {skipped} skipped",
        )
        await manager.broadcast("student_change")

    return {"created": created, "skipped": skipped, "errors": errors}
