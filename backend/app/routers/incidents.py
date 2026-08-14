from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_db
from app.core.websocket import manager
from app.models.incident import LockerIncident
from app.models.locker import Locker
from app.models.user import User
from app.schemas.incident import LockerIncidentCreate, LockerIncidentRead, LockerIncidentUpdate
from app.services.audit import AuditLogService
from app.services.notification import NotificationService

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _incident_read(incident: LockerIncident) -> LockerIncidentRead:
    return LockerIncidentRead(
        id=incident.id,
        locker_id=incident.locker_id,
        locker_number=incident.locker.number if incident.locker else None,
        type=incident.type,
        status=incident.status,
        title=incident.title,
        description=incident.description,
        created_by_id=incident.created_by_id,
        created_by_email=incident.created_by.email if incident.created_by else None,
        resolved_by_id=incident.resolved_by_id,
        resolved_by_email=incident.resolved_by.email if incident.resolved_by else None,
        created_at=incident.created_at,
        resolved_at=incident.resolved_at,
    )


async def _sync_locker_status(db: AsyncSession, locker_id: int) -> None:
    locker = (await db.execute(select(Locker).where(Locker.id == locker_id))).scalar_one_or_none()
    if not locker:
        return
    open_count = (await db.execute(
        select(func.count(LockerIncident.id)).where(
            LockerIncident.locker_id == locker_id,
            LockerIncident.status.in_(["open", "in_progress"]),
        )
    )).scalar_one()
    if open_count > 0:
        locker.status = "maintenance"
    elif locker.status == "maintenance":
        locker.status = "active"


@router.get("/", response_model=list[LockerIncidentRead])
async def list_incidents(
    status_filter: str | None = Query(None, alias="status"),
    locker_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    query = select(LockerIncident)
    if status_filter:
        query = query.where(LockerIncident.status == status_filter)
    if locker_id:
        query = query.where(LockerIncident.locker_id == locker_id)
    query = query.order_by(LockerIncident.id.desc()).offset(skip).limit(limit)
    incidents = list((await db.execute(query)).scalars().all())
    return [_incident_read(i) for i in incidents]


@router.post("/", response_model=LockerIncidentRead, status_code=status.HTTP_201_CREATED)
async def create_incident(
    data: LockerIncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    locker = (await db.execute(select(Locker).where(Locker.id == data.locker_id))).scalar_one_or_none()
    if not locker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Locker not found")

    incident = LockerIncident(
        locker_id=data.locker_id,
        type=data.type,
        status="open",
        title=data.title,
        description=data.description,
        created_by_id=current_admin.id,
    )
    db.add(incident)
    await db.flush()
    await _sync_locker_status(db, data.locker_id)
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="create",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Created incident for locker {locker.number}: {incident.title}",
        new_values={"locker_id": data.locker_id, "type": data.type, "title": data.title},
        commit=False,
    )
    await NotificationService(db).create(
        user_id=current_admin.id,
        title="Incident created",
        message=f"Locker {locker.number} moved to maintenance: {incident.title}",
        type="warning",
        commit=False,
    )
    await db.commit()
    await db.refresh(incident)
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
    return _incident_read(incident)


@router.put("/{incident_id}", response_model=LockerIncidentRead)
async def update_incident(
    incident_id: int,
    data: LockerIncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    incident = (await db.execute(select(LockerIncident).where(LockerIncident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    old_values = {
        "type": incident.type,
        "status": incident.status,
        "title": incident.title,
        "description": incident.description,
    }
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(incident, field, value)
    if incident.status in {"resolved", "cancelled"} and incident.resolved_at is None:
        incident.resolved_at = datetime.now(timezone.utc)
        incident.resolved_by_id = current_admin.id
    if incident.status in {"open", "in_progress"}:
        incident.resolved_at = None
        incident.resolved_by_id = None

    await db.flush()
    await _sync_locker_status(db, incident.locker_id)
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="update",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Updated incident #{incident.id}",
        old_values=old_values,
        new_values=update_data,
        commit=False,
    )
    await db.commit()
    await db.refresh(incident)
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
    return _incident_read(incident)


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    incident = (await db.execute(select(LockerIncident).where(LockerIncident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    locker_id = incident.locker_id
    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="delete",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Deleted incident #{incident.id}",
        old_values={"locker_id": incident.locker_id, "type": incident.type, "status": incident.status},
        commit=False,
    )
    await db.delete(incident)
    await db.flush()
    await _sync_locker_status(db, locker_id)
    await db.commit()
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
