"""practice answers: what each student finished, for the progress report

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "practice_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("set_id", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("lang", sa.String(2), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("topic", sa.String(120), nullable=False),
        sa.Column("steps_total", sa.SmallInteger(), nullable=False),
        sa.Column("steps_right", sa.SmallInteger(), nullable=False),
        sa.Column("answered_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "set_id", "slot", name="uq_practice_answer_set_slot"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_practice_answers_user_time", "practice_answers", ["user_id", "answered_at"])


def downgrade() -> None:
    op.drop_table("practice_answers")
