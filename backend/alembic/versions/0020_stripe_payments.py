"""payments.stripe_session_id: the Stripe Checkout Session a card payment came from

Unique, so a webhook Stripe delivers twice records one payment (MySQL allows many NULLs,
so admin-recorded payments are unaffected).

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("stripe_session_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_payments_stripe_session", "payments", ["stripe_session_id"])


def downgrade() -> None:
    op.drop_constraint("uq_payments_stripe_session", "payments", type_="unique")
    op.drop_column("payments", "stripe_session_id")
