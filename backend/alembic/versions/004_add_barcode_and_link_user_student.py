"""add barcode to students and link user to student

Revision ID: 004_barcode_link
Revises: 003_drop_verification
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

revision = "004_barcode_link"
down_revision = "003_drop_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add barcode column to students
    op.add_column("students", sa.Column("barcode", sa.String(100), nullable=True))

    # Populate existing rows with unique barcodes so we can add a unique constraint
    conn = op.get_bind()
    students = conn.execute(sa.text("SELECT id FROM students ORDER BY id")).fetchall()
    for s in students:
        conn.execute(
            sa.text("UPDATE students SET barcode = :barcode WHERE id = :id"),
            {"barcode": f"STU-{s[0]:06d}", "id": s[0]},
        )

    # Now make it NOT NULL and UNIQUE
    op.alter_column("students", "barcode", nullable=False)
    op.create_unique_constraint("uq_students_barcode", "students", ["barcode"])

    # Add student_id column to users (FK to students)
    op.add_column("users", sa.Column("student_id", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_users_student_id", "users", ["student_id"])
    op.create_foreign_key(
        "fk_users_student_id",
        "users",
        "students",
        ["student_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_student_id", "users", type_="foreignkey")
    op.drop_constraint("uq_users_student_id", "users", type_="unique")
    op.drop_column("users", "student_id")
    op.drop_constraint("uq_students_barcode", "students", type_="unique")
    op.drop_column("students", "barcode")
