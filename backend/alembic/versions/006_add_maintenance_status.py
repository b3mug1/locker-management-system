"""add maintenance status option to lockers

Revision ID: 006_maintenance
Revises: 005_add_course
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = "006_maintenance"
down_revision = "005_add_course"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No schema change needed — status is a VARCHAR, we just use "maintenance" as a value
    pass


def downgrade() -> None:
    # Reset any 'maintenance' lockers to 'inactive'
    op.execute("UPDATE lockers SET status = 'inactive' WHERE status = 'maintenance'")
