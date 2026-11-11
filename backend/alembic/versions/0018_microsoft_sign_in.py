"""users.microsoft_sub: Microsoft sign-in (the ID token's "sub" for KELU's app registration)

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-11
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("microsoft_sub", sa.String(255), nullable=True))
    op.create_index("ix_users_microsoft_sub", "users", ["microsoft_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_microsoft_sub", table_name="users")
    op.drop_column("users", "microsoft_sub")
