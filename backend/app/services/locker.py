from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import Assignment
from app.models.locker import Locker
from app.schemas.locker import LockerCreate, LockerUpdate


class LockerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, locker_id: int) -> Locker | None:
        result = await self.db.execute(select(Locker).where(Locker.id == locker_id))
        return result.scalar_one_or_none()

    async def get_by_number(self, number: str) -> Locker | None:
        result = await self.db.execute(select(Locker).where(Locker.number == number))
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[dict]:
        result = await self.db.execute(
            select(Locker).order_by(Locker.id).offset(skip).limit(limit)
        )
        lockers = list(result.scalars().all())
        locker_ids = [locker.id for locker in lockers]
        occupied_by_locker: dict[int, int] = {}
        if locker_ids:
            occupied_result = await self.db.execute(
                select(Assignment.locker_id, func.count(Assignment.id))
                .where(
                    Assignment.locker_id.in_(locker_ids),
                    Assignment.released_at.is_(None),
                )
                .group_by(Assignment.locker_id)
            )
            occupied_by_locker = dict(occupied_result.all())

        locker_data = []
        for locker in lockers:
            locker_dict = {
                "id": locker.id,
                "number": locker.number,
                "size": locker.size,
                "access_type": locker.access_type,
                "capacity": locker.capacity,
                "floor": locker.floor,
                "status": locker.status,
                "occupied_count": occupied_by_locker.get(locker.id, 0),
            }
            locker_data.append(locker_dict)
        return locker_data

    async def count(self) -> int:
        result = await self.db.execute(select(func.count(Locker.id)))
        return result.scalar_one()

    async def create(
        self,
        data: LockerCreate,
        *,
        commit: bool = True,
        flush: bool = True,
    ) -> Locker:
        locker = Locker(
            number=data.number,
            size=data.size,
            access_type=data.access_type,
            capacity=data.capacity,
            floor=data.floor,
            status=data.status,
        )
        self.db.add(locker)
        if commit:
            await self.db.commit()
            await self.db.refresh(locker)
        elif flush:
            await self.db.flush()
        return locker

    async def update(self, locker_id: int, data: LockerUpdate, *, commit: bool = True) -> Locker | None:
        locker = await self.get_by_id(locker_id)
        if not locker:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(locker, field, value)
        if commit:
            await self.db.commit()
            await self.db.refresh(locker)
        else:
            await self.db.flush()
        return locker

    async def delete(self, locker_id: int, *, commit: bool = True) -> bool:
        locker = await self.get_by_id(locker_id)
        if not locker:
            return False
        await self.db.delete(locker)
        if commit:
            await self.db.commit()
        else:
            await self.db.flush()
        return True

    async def get_occupied_count(self, locker_id: int) -> int:
        result = await self.db.execute(
            select(func.count(Assignment.id)).where(
                Assignment.locker_id == locker_id,
                Assignment.released_at.is_(None),
            )
        )
        return result.scalar_one()
