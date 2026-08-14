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


class AutoAssignRequest(BaseModel):
    max_assignments: int | None = None
    commit: bool = False


class AutoAssignItem(BaseModel):
    student_id: int
    student_name: str
    student_group: str
    student_course: int
    inclusive_status: str
    locker_id: int
    locker_number: str
    locker_floor: int
    locker_size: str
    locker_capacity: int
    locker_occupied_before: int


class AutoAssignResult(BaseModel):
    planned: int
    created: int
    skipped_students: int
    available_spots: int
    items: list[AutoAssignItem]
