from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    actor_id: int | None = None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    summary: str
    old_values: dict | None = None
    new_values: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
