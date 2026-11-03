"""google sign-in columns, password reset codes

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    op.create_table(
        "password_reset_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_password_reset_codes_user_id", "password_reset_codes", ["user_id"])


def downgrade() -> None:
    op.drop_table("password_reset_codes")
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "google_sub")
    # Fails if any Google-only accounts (NULL password_hash) exist; delete or fix them first.
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=False)
