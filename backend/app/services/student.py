from __future__ import annotations

from sqlalchemy import case, select
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
            select(Student)
            .order_by(
                case((Student.inclusive_status != "none", 0), else_=1),
                Student.id,
            )
            .offset(skip)
            .limit(limit)
        )
        students = list(result.scalars().all())
        return students

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self.db.execute(select(func.count(Student.id)))
        return result.scalar_one()

    async def create(
        self,
        data: StudentCreate,
        *,
        commit: bool = True,
        flush: bool = True,
    ) -> Student:
        student = Student(
            full_name=data.full_name,
            group=data.group,
            barcode=data.barcode,
            course=data.course,
            inclusive_status=data.inclusive_status,
        )
        self.db.add(student)
        if commit:
            await self.db.commit()
            await self.db.refresh(student)
        elif flush:
            await self.db.flush()
        return student

    async def update(self, student_id: int, data: StudentUpdate, *, commit: bool = True) -> Student | None:
        student = await self.get_by_id(student_id)
        if not student:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(student, field, value)
        if commit:
            await self.db.commit()
            await self.db.refresh(student)
        else:
            await self.db.flush()
        return student

    async def delete(self, student_id: int, *, commit: bool = True) -> bool:
        student = await self.get_by_id(student_id)
        if not student:
            return False
        await self.db.delete(student)
        if commit:
            await self.db.commit()
        else:
            await self.db.flush()
        return True
