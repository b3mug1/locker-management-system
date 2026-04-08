from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    student_id: int
    locker_id: int
    force: bool = False  # override priority warning


class AssignmentRead(BaseModel):
    id: int
    student_id: int
    locker_id: int
    assigned_at: datetime
    released_at: datetime | None = None
    student_name: str | None = None
    locker_number: str | None = None

    model_config = {"from_attributes": True}
