"""daily_usage: chat messages and practice quizzes used per day, for the free plan's limits

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("ref", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "day", "kind", "ref", name="uq_daily_usage_ref"),
    )
    op.create_index("ix_daily_usage_user_day", "daily_usage", ["user_id", "day"])


def downgrade() -> None:
    op.drop_table("daily_usage")
