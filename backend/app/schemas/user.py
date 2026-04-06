from __future__ import annotations

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "user"
    student_id: int | None = None


class UserRead(BaseModel):
    id: int
    email: str
    role: str
    student_id: int | None = None
    student_name: str | None = None
    student_barcode: str | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: str | None = None
    role: str | None = None
    student_id: int | None = None
