"""add indexes for assignment lookups

Revision ID: 009_add_assignment_indexes
Revises: 008_incidents_audit
Create Date: 2026-09-17
"""
from typing import Sequence, Union

from alembic import op


revision: str = "009_add_assignment_indexes"
down_revision: Union[str, None] = "008_incidents_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_assignments_locker_released",
        "assignments",
        ["locker_id", "released_at"],
        unique=False,
    )
    op.create_index(
        "ix_assignments_student_released",
        "assignments",
        ["student_id", "released_at"],
        unique=False,
    )
    op.create_index(
        "ix_assignments_released_at",
        "assignments",
        ["released_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_assignments_released_at", table_name="assignments")
    op.drop_index("ix_assignments_student_released", table_name="assignments")
    op.drop_index("ix_assignments_locker_released", table_name="assignments")
