from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

INCLUSIVE_STATUSES = Literal["none", "disability", "orphan", "vision", "hearing", "other"]


class StudentCreate(BaseModel):
    full_name: str
    group: str
    barcode: str
    course: int
    inclusive_status: INCLUSIVE_STATUSES = "none"
    activity_score: int = Field(default=50, ge=0, le=100)
    gpa: float = Field(default=3.0, ge=0.0, le=4.0)


class StudentRead(BaseModel):
    id: int
    full_name: str
    group: str
    barcode: str
    course: int
    inclusive_status: str = "none"
    activity_score: int = 50
    gpa: float = 3.0

    model_config = {"from_attributes": True}


class StudentUpdate(BaseModel):
    full_name: str | None = None
    group: str | None = None
    barcode: str | None = None
    course: int | None = None
    inclusive_status: INCLUSIVE_STATUSES | None = None
    activity_score: int | None = Field(default=None, ge=0, le=100)
    gpa: float | None = Field(default=None, ge=0.0, le=4.0)
