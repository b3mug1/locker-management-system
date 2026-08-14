from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogRead
from app.services.audit import AuditLogService

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/", response_model=list[AuditLogRead])
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    logs = await AuditLogService(db).get_all(skip=skip, limit=limit)
    return [
        AuditLogRead(
            id=log.id,
            actor_id=log.actor_id,
            actor_email=log.actor.email if log.actor else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            summary=log.summary,
            old_values=log.old_values,
            new_values=log.new_values,
            created_at=log.created_at,
        )
        for log in logs
    ]
