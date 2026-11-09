"""tutor conversations: AI-tutor chats kept on the server, so saved chats follow the student

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutor_conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("saved", sa.Boolean(), nullable=False),
        sa.Column("hint_level", sa.SmallInteger(), nullable=False),
        sa.Column("messages", sa.JSON(), nullable=False),
        sa.Column("created_ms", sa.BigInteger(), nullable=False),
        sa.Column("updated_ms", sa.BigInteger(), nullable=False),
        sa.Column("stored_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "client_id", name="uq_tutor_conversation_client"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_tutor_conversations_user_updated", "tutor_conversations", ["user_id", "updated_ms"])


def downgrade() -> None:
    op.drop_table("tutor_conversations")
