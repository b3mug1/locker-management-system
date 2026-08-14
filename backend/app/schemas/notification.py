from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
