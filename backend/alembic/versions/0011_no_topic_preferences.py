"""remove student_topic_preferences: clicking a topic starts its quiz, with nothing to choose

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("student_topic_preferences")


def downgrade() -> None:
    op.create_table(
        "student_topic_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("topic_id", sa.SmallInteger(), sa.ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
