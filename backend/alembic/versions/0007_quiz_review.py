"""quiz review: bank questions have a status, and admin generation jobs are recorded

Every existing question stays published, so quizzes carry on as they were.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quiz_bank", sa.Column("status", sa.String(12), nullable=False, server_default="published"))
    op.create_index("ix_quiz_bank_status", "quiz_bank", ["status"])
    op.create_table(
        "quiz_generation_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lang", sa.String(2), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("requested", sa.SmallInteger(), nullable=False),
        sa.Column("added", sa.SmallInteger(), nullable=False),
        sa.Column("failed", sa.SmallInteger(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    op.drop_table("quiz_generation_jobs")
    op.drop_index("ix_quiz_bank_status", table_name="quiz_bank")
    op.drop_column("quiz_bank", "status")
