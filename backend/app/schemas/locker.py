from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Valid locker configurations: size → access_type → capacity
LOCKER_RULES: dict[str, dict[str, int]] = {
    "large": {"pin": 1},
    "medium": {"pin": 2, "key": 2},
    "small": {"key": 1},
}


def _validate_locker_config(size: str, access_type: str, capacity: int) -> None:
    """Enforce locker business rules."""
    allowed = LOCKER_RULES.get(size)
    if allowed is None:
        raise ValueError(f"Invalid size '{size}'. Must be one of: large, medium, small")
    expected_capacity = allowed.get(access_type)
    if expected_capacity is None:
        valid_types = ", ".join(allowed.keys())
        raise ValueError(
            f"Access type '{access_type}' is not allowed for {size} lockers. "
            f"Allowed: {valid_types}"
        )
    if capacity != expected_capacity:
        raise ValueError(
            f"{size.capitalize()} locker with {access_type} access must have "
            f"capacity {expected_capacity}, got {capacity}"
        )


class LockerCreate(BaseModel):
    number: str
    size: Literal["small", "medium", "large"] = "medium"
    access_type: Literal["pin", "key"] = "key"
    capacity: int = Field(default=1, ge=1, le=2)
    floor: int = 1
    status: Literal["active", "inactive", "maintenance"] = "active"

    @model_validator(mode="after")
    def check_locker_rules(self):
        _validate_locker_config(self.size, self.access_type, self.capacity)
        return self


class LockerRead(BaseModel):
    id: int
    number: str
    size: str
    access_type: str
    capacity: int
    floor: int
    status: str = "active"
    occupied_count: int = 0

    model_config = {"from_attributes": True}


class LockerUpdate(BaseModel):
    number: str | None = None
    size: Literal["small", "medium", "large"] | None = None
    access_type: Literal["pin", "key"] | None = None
    capacity: int | None = Field(default=None, ge=1, le=2)
    floor: int | None = None
    status: Literal["active", "inactive", "maintenance"] | None = None
