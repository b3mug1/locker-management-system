from __future__ import annotations

from pydantic import BaseModel


class StudentCreate(BaseModel):
    full_name: str
    group: str
    barcode: str
    course: int


class StudentRead(BaseModel):
    id: int
    full_name: str
    group: str
    barcode: str
    course: int

    model_config = {"from_attributes": True}


class StudentUpdate(BaseModel):
    full_name: str | None = None
    group: str | None = None
    barcode: str | None = None
    course: int | None = None
