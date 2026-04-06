from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Locker(Base):
    __tablename__ = "lockers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    size: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")  # small / medium / large
    access_type: Mapped[str] = mapped_column(String(20), nullable=False, default="key")  # pin / key
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 or 2
    floor: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active / inactive

    assignments = relationship("Assignment", back_populates="locker", lazy="selectin", cascade="all, delete-orphan", passive_deletes=True)
