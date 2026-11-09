"""saved questions: a student's bookmarked practice questions, kept across devices

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_hash", sa.String(64), nullable=False),
        sa.Column("topic", sa.String(120), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "question_hash", name="uq_saved_question_user_hash"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_saved_questions_user_time", "saved_questions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("saved_questions")
