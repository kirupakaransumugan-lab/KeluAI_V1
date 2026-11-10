"""plans: admin-edited names, prices and visibility; "annual" becomes "until_exam"

The price list is now Free, Monthly, Until exam and Class plan (app/services/plans.py).
No rows are seeded: a plan with no row uses the defaults in code.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("key", sa.String(20), primary_key=True),
        sa.Column("name_en", sa.String(60), nullable=False),
        sa.Column("name_ta", sa.String(120), nullable=False),
        sa.Column("price_lkr", sa.Integer(), nullable=False),
        sa.Column("blurb_en", sa.String(255), nullable=False),
        sa.Column("blurb_ta", sa.String(500), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("highlight", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.execute("UPDATE subscriptions SET plan = 'until_exam' WHERE plan = 'annual'")
    op.execute("UPDATE payments SET plan = 'until_exam' WHERE plan = 'annual'")


def downgrade() -> None:
    op.execute("UPDATE payments SET plan = 'annual' WHERE plan = 'until_exam'")
    op.execute("UPDATE subscriptions SET plan = 'annual' WHERE plan = 'until_exam'")
    op.drop_table("plans")
