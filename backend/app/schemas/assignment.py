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
    activity_score: int = 50
    gpa: float = 3.0
    tier: int = 4
    tier_name: str = "Общий поток"
    priority_score: float = 0.0
    ai_reason: str = ""
    locker_id: int
    locker_number: str
    locker_floor: int
    locker_size: str
    locker_access_type: str = "pin"
    locker_capacity: int
    locker_occupied_before: int


class AutoAssignResult(BaseModel):
    planned: int
    created: int
    skipped_students: int
    available_spots: int
    tier_1_count: int = 0
    tier_2_count: int = 0
    tier_3_count: int = 0
    tier_4_count: int = 0
    items: list[AutoAssignItem]
