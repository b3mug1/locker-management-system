"""add active assignment constraint and missing lookup/schema columns

Revision ID: 010_add_integrity_and_lookup_indexes
Revises: 009_add_assignment_indexes
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "010_add_integrity_and_lookup_indexes"
down_revision: Union[str, None] = "009_add_assignment_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("students", sa.Column("activity_score", sa.Integer(), nullable=False, server_default="50"))
    op.add_column("students", sa.Column("gpa", sa.Float(), nullable=False, server_default="3.0"))

    op.add_column("locker_incidents", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column("locker_incidents", sa.Column("assigned_technician_id", sa.Integer(), nullable=True))
    op.add_column("locker_incidents", sa.Column("technician_notes", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_locker_incidents_assigned_technician",
        "locker_incidents",
        "users",
        ["assigned_technician_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "uq_assignments_active_student",
        "assignments",
        ["student_id"],
        unique=True,
        postgresql_where=sa.text("released_at IS NULL"),
    )
    op.create_index("ix_assignments_assigned_at", "assignments", ["assigned_at"])
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])
    op.create_index("ix_locker_incidents_assigned_technician", "locker_incidents", ["assigned_technician_id"])
    op.create_index("ix_locker_incidents_created_at", "locker_incidents", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_locker_incidents_created_at", table_name="locker_incidents")
    op.drop_index("ix_locker_incidents_assigned_technician", table_name="locker_incidents")
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_assignments_assigned_at", table_name="assignments")
    op.drop_index("uq_assignments_active_student", table_name="assignments")
    op.drop_constraint("fk_locker_incidents_assigned_technician", "locker_incidents", type_="foreignkey")
    op.drop_column("locker_incidents", "technician_notes")
    op.drop_column("locker_incidents", "assigned_technician_id")
    op.drop_column("locker_incidents", "image_url")
    op.drop_column("students", "gpa")
    op.drop_column("students", "activity_score")