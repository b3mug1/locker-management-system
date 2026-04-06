from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    group: Mapped[str] = mapped_column(String(100), nullable=False)
    barcode: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    course: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    assignments = relationship("Assignment", back_populates="student", lazy="selectin", cascade="all, delete-orphan", passive_deletes=True)
    user = relationship("User", back_populates="student", uselist=False, lazy="selectin")
