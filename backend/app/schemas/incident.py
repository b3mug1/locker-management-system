from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

IncidentType = Literal["broken_door", "lost_key", "lock_broken", "needs_repair", "other"]
IncidentStatus = Literal["open", "assigned", "in_progress", "resolved", "cancelled", "rejected"]


class LockerIncidentCreate(BaseModel):
    locker_id: int
    type: IncidentType
    title: str
    description: str | None = None
    image_url: str | None = None


class LockerIncidentUpdate(BaseModel):
    type: IncidentType | None = None
    status: IncidentStatus | None = None
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    assigned_technician_id: int | None = None
    technician_notes: str | None = None


class LockerIncidentAssign(BaseModel):
    technician_id: int


class LockerIncidentResolve(BaseModel):
    notes: str | None = None


class LockerIncidentRead(BaseModel):
    id: int
    locker_id: int
    locker_number: str | None = None
    locker_floor: int | None = None
    type: str
    status: str
    title: str
    description: str | None = None
    image_url: str | None = None
    created_by_id: int | None = None
    created_by_email: str | None = None
    created_by_name: str | None = None
    assigned_technician_id: int | None = None
    assigned_technician_email: str | None = None
    resolved_by_id: int | None = None
    resolved_by_email: str | None = None
    technician_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}
