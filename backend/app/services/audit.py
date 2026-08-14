from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditLogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        actor_id: int | None,
        action: str,
        entity_type: str,
        entity_id: int | None,
        summary: str,
        old_values: dict | None = None,
        new_values: dict | None = None,
        commit: bool = True,
    ) -> AuditLog:
        log = AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            old_values=old_values,
            new_values=new_values,
        )
        self.db.add(log)
        if commit:
            await self.db.commit()
            await self.db.refresh(log)
        else:
            await self.db.flush()
        return log

    async def get_all(self, skip: int = 0, limit: int = 200) -> list[AuditLog]:
        result = await self.db.execute(
            select(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())
