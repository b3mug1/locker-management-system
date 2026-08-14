from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: int,
        title: str,
        message: str,
        type: str = "info",
        commit: bool = True,
    ) -> Notification:
        notification = Notification(user_id=user_id, title=title, message=message, type=type)
        self.db.add(notification)
        if commit:
            await self.db.commit()
            await self.db.refresh(notification)
        else:
            await self.db.flush()
        return notification

    async def get_for_user(self, user_id: int, skip: int = 0, limit: int = 100) -> list[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.id.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_unread(self, user_id: int) -> int:
        result = await self.db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        )
        return result.scalar_one()

    async def mark_read(self, user_id: int, notification_id: int) -> bool:
        result = await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def mark_all_read(self, user_id: int) -> int:
        result = await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        await self.db.commit()
        return result.rowcount
