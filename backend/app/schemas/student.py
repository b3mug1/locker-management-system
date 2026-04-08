from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

INCLUSIVE_STATUSES = Literal["none", "disability", "orphan", "vision", "hearing", "other"]


class StudentCreate(BaseModel):
    full_name: str
    group: str
    barcode: str
    course: int
    inclusive_status: INCLUSIVE_STATUSES = "none"


class StudentRead(BaseModel):
    id: int
    full_name: str
    group: str
    barcode: str
    course: int
    inclusive_status: str = "none"

    model_config = {"from_attributes": True}


class StudentUpdate(BaseModel):
    full_name: str | None = None
    group: str | None = None
    barcode: str | None = None
    course: int | None = None
    inclusive_status: INCLUSIVE_STATUSES | None = None
