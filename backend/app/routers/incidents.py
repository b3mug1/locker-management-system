from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin, get_current_staff, get_current_user, get_db
from app.core.websocket import manager
from app.models.assignment import Assignment
from app.models.incident import LockerIncident
from app.models.locker import Locker
from app.models.student import Student
from app.models.user import User
from app.schemas.incident import (
    LockerIncidentAssign,
    LockerIncidentCreate,
    LockerIncidentRead,
    LockerIncidentResolve,
    LockerIncidentUpdate,
)
from app.services.audit import AuditLogService
from app.services.notification import NotificationService

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _incident_read(incident: LockerIncident) -> LockerIncidentRead:
    creator_name = None
    if incident.created_by:
        if incident.created_by.student:
            creator_name = incident.created_by.student.full_name
        else:
            creator_name = incident.created_by.email

    return LockerIncidentRead(
        id=incident.id,
        locker_id=incident.locker_id,
        locker_number=incident.locker.number if incident.locker else None,
        locker_floor=incident.locker.floor if incident.locker else None,
        type=incident.type,
        status=incident.status,
        title=incident.title,
        description=incident.description,
        image_url=incident.image_url,
        created_by_id=incident.created_by_id,
        created_by_email=incident.created_by.email if incident.created_by else None,
        created_by_name=creator_name,
        assigned_technician_id=incident.assigned_technician_id,
        assigned_technician_email=incident.assigned_technician.email if incident.assigned_technician else None,
        resolved_by_id=incident.resolved_by_id,
        resolved_by_email=incident.resolved_by.email if incident.resolved_by else None,
        technician_notes=incident.technician_notes,
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
            LockerIncident.status.in_(["open", "assigned", "in_progress"]),
        )
    )).scalar_one()
    if open_count > 0:
        locker.status = "maintenance"
    elif locker.status == "maintenance":
        locker.status = "active"


@router.get("/technicians")
async def list_technicians(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_staff),
):
    """List all users with role 'technician'."""
    result = await db.execute(select(User).where(User.role == "technician"))
    technicians = list(result.scalars().all())
    return [
        {"id": t.id, "email": t.email, "role": t.role}
        for t in technicians
    ]


@router.get("/my-tasks", response_model=list[LockerIncidentRead])
async def list_my_technician_tasks(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tasks assigned to the current technician."""
    query = select(LockerIncident).where(LockerIncident.assigned_technician_id == current_user.id)
    if status_filter:
        query = query.where(LockerIncident.status == status_filter)
    query = query.order_by(LockerIncident.id.desc())
    incidents = list((await db.execute(query)).scalars().all())
    return [_incident_read(i) for i in incidents]


@router.get("/", response_model=list[LockerIncidentRead])
async def list_incidents(
    status_filter: str | None = Query(None, alias="status"),
    locker_id: int | None = Query(None),
    technician_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff),
):
    query = select(LockerIncident)
    if current_user.role == "technician":
        query = query.where(LockerIncident.assigned_technician_id == current_user.id)
    elif technician_id:
        query = query.where(LockerIncident.assigned_technician_id == technician_id)

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
    current_user: User = Depends(get_current_user),
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
        image_url=data.image_url,
        created_by_id=current_user.id,
    )
    db.add(incident)
    await db.flush()
    await _sync_locker_status(db, data.locker_id)

    await AuditLogService(db).create(
        actor_id=current_user.id,
        action="create",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Created incident for locker {locker.number}: {incident.title}",
        new_values={"locker_id": data.locker_id, "type": data.type, "title": data.title, "has_image": bool(data.image_url)},
        commit=False,
    )

    # Notify all admins about new incident
    admins = list((await db.execute(select(User).where(User.role == "admin"))).scalars().all())
    for admin in admins:
        await NotificationService(db).create(
            user_id=admin.id,
            title="Новая заявка на ремонт",
            message=f"Шкафчик №{locker.number}: {incident.title} (создал {current_user.email})",
            type="warning",
            commit=False,
        )

    await db.commit()
    await db.refresh(incident)
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
    return _incident_read(incident)


@router.post("/{incident_id}/assign", response_model=LockerIncidentRead)
async def assign_technician(
    incident_id: int,
    data: LockerIncidentAssign,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin assigns an incident to a technician."""
    incident = (await db.execute(select(LockerIncident).where(LockerIncident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    technician = (await db.execute(select(User).where(User.id == data.technician_id))).scalar_one_or_none()
    if not technician or technician.role != "technician":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid technician ID")

    incident.assigned_technician_id = technician.id
    incident.status = "assigned"
    await db.flush()
    await _sync_locker_status(db, incident.locker_id)

    # Notify the assigned technician
    await NotificationService(db).create(
        user_id=technician.id,
        title="Новая задача на ремонт",
        message=f"Вам назначена заявка #{incident.id} по шкафчику №{incident.locker.number if incident.locker else ''}: {incident.title}",
        type="info",
        commit=False,
    )

    await AuditLogService(db).create(
        actor_id=current_admin.id,
        action="assign",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Assigned incident #{incident.id} to technician {technician.email}",
        new_values={"assigned_technician_id": technician.id},
        commit=False,
    )

    await db.commit()
    await db.refresh(incident)
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
    return _incident_read(incident)


@router.post("/{incident_id}/start", response_model=LockerIncidentRead)
async def start_repair(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff),
):
    """Technician marks the incident as in progress."""
    incident = (await db.execute(select(LockerIncident).where(LockerIncident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if current_user.role == "technician" and incident.assigned_technician_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This task is not assigned to you")

    incident.status = "in_progress"
    await db.flush()
    await _sync_locker_status(db, incident.locker_id)

    await AuditLogService(db).create(
        actor_id=current_user.id,
        action="update",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Technician started repair on incident #{incident.id}",
        new_values={"status": "in_progress"},
        commit=False,
    )

    await db.commit()
    await db.refresh(incident)
    await manager.broadcast("locker_change")
    await manager.broadcast("incident_change")
    return _incident_read(incident)


@router.post("/{incident_id}/resolve", response_model=LockerIncidentRead)
async def resolve_incident(
    incident_id: int,
    data: LockerIncidentResolve,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_staff),
):
    """Technician marks incident as resolved with notes."""
    incident = (await db.execute(select(LockerIncident).where(LockerIncident.id == incident_id))).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    if current_user.role == "technician" and incident.assigned_technician_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This task is not assigned to you")

    incident.status = "resolved"
    incident.resolved_at = datetime.now(timezone.utc)
    incident.resolved_by_id = current_user.id
    if data.notes:
        incident.technician_notes = data.notes

    await db.flush()
    await _sync_locker_status(db, incident.locker_id)

    # Notify student (creator or current occupant of locker)
    if incident.created_by_id:
        await NotificationService(db).create(
            user_id=incident.created_by_id,
            title="Шкафчик отремонтирован",
            message=f"Ремонт шкафчика №{incident.locker.number if incident.locker else ''} успешно завершён. Отчёт: {data.notes or 'Неисправность устранена.'}",
            type="success",
            commit=False,
        )

    await AuditLogService(db).create(
        actor_id=current_user.id,
        action="resolve",
        entity_type="incident",
        entity_id=incident.id,
        summary=f"Resolved incident #{incident.id} by {current_user.email}",
        new_values={"status": "resolved", "notes": data.notes},
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
        "assigned_technician_id": incident.assigned_technician_id,
        "technician_notes": incident.technician_notes,
    }
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(incident, field, value)

    if incident.status in {"resolved", "cancelled", "rejected"} and incident.resolved_at is None:
        incident.resolved_at = datetime.now(timezone.utc)
        incident.resolved_by_id = current_admin.id
    if incident.status in {"open", "assigned", "in_progress"}:
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
