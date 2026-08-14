from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


class LockerIncident(Base):
    __tablename__ = "locker_incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    locker_id: Mapped[int] = mapped_column(Integer, ForeignKey("lockers.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    locker = relationship("Locker", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id], lazy="selectin")
