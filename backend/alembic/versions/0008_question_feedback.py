"""question feedback: student reports on bank questions, and approved alternative methods

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("quiz_bank.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("image_name", sa.String(60), nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("ai_verdict", sa.String(15), nullable=True),
        sa.Column("ai_reason", sa.Text(), nullable=True),
        sa.Column("ai_suggestion", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_question_feedback_status", "question_feedback", ["status", "created_at"])
    op.create_index("ix_question_feedback_question_id", "question_feedback", ["question_id"])
    op.create_index("ix_question_feedback_user_id", "question_feedback", ["user_id"])
    op.create_table(
        "quiz_question_methods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("quiz_bank.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_quiz_question_methods_question_id", "quiz_question_methods", ["question_id"])


def downgrade() -> None:
    op.drop_table("quiz_question_methods")
    op.drop_table("question_feedback")
