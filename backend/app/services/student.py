from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student
from app.schemas.student import StudentCreate, StudentUpdate


class StudentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, student_id: int) -> Student | None:
        result = await self.db.execute(select(Student).where(Student.id == student_id))
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[Student]:
        result = await self.db.execute(
            select(Student).offset(skip).limit(limit)
        )
        students = list(result.scalars().all())
        # Priority students (any inclusive status != "none") appear first
        return sorted(students, key=lambda s: (0 if s.inclusive_status != "none" else 1, s.id))

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self.db.execute(select(func.count(Student.id)))
        return result.scalar_one()

    async def create(self, data: StudentCreate) -> Student:
        student = Student(
            full_name=data.full_name,
            group=data.group,
            barcode=data.barcode,
            course=data.course,
            inclusive_status=data.inclusive_status,
        )
        self.db.add(student)
        await self.db.commit()
        await self.db.refresh(student)
        return student

    async def update(self, student_id: int, data: StudentUpdate) -> Student | None:
        student = await self.get_by_id(student_id)
        if not student:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(student, field, value)
        await self.db.commit()
        await self.db.refresh(student)
        return student

    async def delete(self, student_id: int) -> bool:
        student = await self.get_by_id(student_id)
        if not student:
            return False
        await self.db.delete(student)
        await self.db.commit()
        return True
