"""
Seed script – populates the database with:
  • 1 admin user
  • 100 students
  • 100 lockers
Run: python -m app.seed
"""
from __future__ import annotations

import random
import sys

from faker import Faker
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base  # noqa – registers models
from app.models.user import User
from app.models.student import Student
from app.models.locker import Locker

fake = Faker()


def seed() -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC, echo=False)

    with Session(engine) as session:
        # Check if admin already exists
        existing_admin = session.execute(
            select(User).where(User.email == settings.FIRST_ADMIN_EMAIL)
        ).scalar_one_or_none()

        if existing_admin:
            print("[seed] Admin already exists – skipping seed.")
            return

        # Create admin user
        admin = User(
            email=settings.FIRST_ADMIN_EMAIL,
            password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
            role="admin",
        )
        session.add(admin)

        # Create 100 students
        groups = ["CS-101", "CS-102", "CS-201", "CS-202", "EE-101", "EE-201", "ME-101", "ME-201", "BA-101", "BA-201"]
        students: list[Student] = []
        for i in range(1, 101):
            s = Student(
                full_name=fake.name(),
                group=random.choice(groups),
                barcode=f"STU-{i:06d}",
            )
            session.add(s)
            students.append(s)

        # Create 100 lockers following the 4 allowed configurations
        locker_configs = [
            {"size": "large",  "access_type": "pin", "capacity": 1},
            {"size": "medium", "access_type": "pin", "capacity": 2},
            {"size": "medium", "access_type": "key", "capacity": 2},
            {"size": "small",  "access_type": "key", "capacity": 1},
        ]
        for i in range(1, 101):
            cfg = random.choice(locker_configs)
            locker = Locker(
                number=f"L-{i:03d}",
                size=cfg["size"],
                access_type=cfg["access_type"],
                capacity=cfg["capacity"],
                floor=random.randint(1, 4),
                status="active",
            )
            session.add(locker)

        session.commit()
        print("[seed] Successfully created: 1 admin, 100 students, 100 lockers.")


if __name__ == "__main__":
    seed()
