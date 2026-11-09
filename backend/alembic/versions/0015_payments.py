"""payments: plan payments an admin records (bank transfer, cash...) until online payment exists

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("amount_lkr", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("reference", sa.String(120), nullable=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=False),
        sa.Column("recorded_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_paid_at", "payments", ["paid_at"])


def downgrade() -> None:
    op.drop_table("payments")
