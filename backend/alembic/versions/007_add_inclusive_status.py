"""add inclusive_status to students

Revision ID: 007_inclusive_status
Revises: 006_maintenance
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "007_inclusive_status"
down_revision = "006_maintenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column(
            "inclusive_status",
            sa.String(50),
            nullable=False,
            server_default="none",
        ),
    )


def downgrade() -> None:
    op.drop_column("students", "inclusive_status")
