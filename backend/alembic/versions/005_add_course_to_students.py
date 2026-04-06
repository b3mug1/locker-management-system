"""add course field to students

Revision ID: 005_add_course
Revises: 004_barcode_link
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = "005_add_course"
down_revision = "004_barcode_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("students", sa.Column("course", sa.Integer(), nullable=True))
    # Set default value for existing rows
    op.execute("UPDATE students SET course = 1 WHERE course IS NULL")
    op.alter_column("students", "course", nullable=False)


def downgrade() -> None:
    op.drop_column("students", "course")
