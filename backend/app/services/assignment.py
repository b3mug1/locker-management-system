from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.locker import Locker
from app.models.student import Student
from app.schemas.assignment import AssignmentCreate


class AssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, assignment_id: int) -> Assignment | None:
        result = await self.db.execute(
            select(Assignment).where(Assignment.id == assignment_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 200) -> list[dict]:
        result = await self.db.execute(
            select(Assignment).order_by(Assignment.id.desc()).offset(skip).limit(limit)
        )
        assignments = list(result.scalars().all())
        data = []
        for a in assignments:
            data.append({
                "id": a.id,
                "student_id": a.student_id,
                "locker_id": a.locker_id,
                "assigned_at": a.assigned_at,
                "released_at": a.released_at,
                "student_name": a.student.full_name if a.student else None,
                "locker_number": a.locker.number if a.locker else None,
            })
        return data

    async def get_active_by_student(self, student_id: int) -> Assignment | None:
        result = await self.db.execute(
            select(Assignment).where(
                Assignment.student_id == student_id,
                Assignment.released_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_active_by_locker(self, locker_id: int) -> list[Assignment]:
        result = await self.db.execute(
            select(Assignment).where(
                Assignment.locker_id == locker_id,
                Assignment.released_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def get_by_user_email(self, email: str) -> list[dict]:
        """Get assignments for the student linked to this user account."""
        from app.models.user import User
        user_result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = user_result.scalar_one_or_none()
        if not user or not user.student_id:
            return []

        result = await self.db.execute(
            select(Assignment)
            .where(Assignment.student_id == user.student_id)
            .order_by(Assignment.id.desc())
        )
        assignments = list(result.scalars().all())
        data = []
        for a in assignments:
            data.append({
                "id": a.id,
                "student_id": a.student_id,
                "locker_id": a.locker_id,
                "assigned_at": a.assigned_at,
                "released_at": a.released_at,
                "student_name": a.student.full_name if a.student else None,
                "locker_number": a.locker.number if a.locker else None,
            })
        return data

    async def assign(self, data: AssignmentCreate) -> Assignment:
        # Verify student exists
        student_result = await self.db.execute(
            select(Student).where(Student.id == data.student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )

        # Verify locker exists
        locker_result = await self.db.execute(
            select(Locker).where(Locker.id == data.locker_id)
        )
        locker = locker_result.scalar_one_or_none()
        if not locker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Locker not found",
            )

        # Check locker is active
        if locker.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign an inactive locker",
            )

        # Check if student already has an active assignment
        existing = await self.get_active_by_student(data.student_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already has an active locker assignment",
            )

        # Check locker capacity
        active_count_result = await self.db.execute(
            select(func.count(Assignment.id)).where(
                Assignment.locker_id == data.locker_id,
                Assignment.released_at.is_(None),
            )
        )
        active_count = active_count_result.scalar_one()
        if active_count >= locker.capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Locker is at full capacity ({locker.capacity})",
            )

        # Priority check: if the student being assigned has no inclusive status,
        # warn admin if there are priority (inclusive) students still without a locker.
        if student.inclusive_status == "none" and not data.force:
            unassigned_priority_result = await self.db.execute(
                select(func.count(Student.id)).where(
                    Student.inclusive_status != "none",
                    ~Student.id.in_(
                        select(Assignment.student_id).where(Assignment.released_at.is_(None))
                    ),
                )
            )
            unassigned_priority_count = unassigned_priority_result.scalar_one()
            if unassigned_priority_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"priority_students_waiting:{unassigned_priority_count}"
                    ),
                )

        assignment = Assignment(
            student_id=data.student_id,
            locker_id=data.locker_id,
        )
        self.db.add(assignment)
        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def release(self, assignment_id: int) -> Assignment | None:
        assignment = await self.get_by_id(assignment_id)
        if not assignment:
            return None
        if assignment.released_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignment already released",
            )
        assignment.released_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def count_active(self) -> int:
        result = await self.db.execute(
            select(func.count(Assignment.id)).where(Assignment.released_at.is_(None))
        )
        return result.scalar_one()

    async def release_all(self) -> int:
        """Release all active assignments. Returns the number of released assignments."""
        result = await self.db.execute(
            select(Assignment).where(Assignment.released_at.is_(None))
        )
        active_assignments = list(result.scalars().all())
        now = datetime.now(timezone.utc)
        for assignment in active_assignments:
            assignment.released_at = now
        await self.db.commit()
        return len(active_assignments)
