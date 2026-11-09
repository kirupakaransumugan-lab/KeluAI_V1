"""quiz bank: AI-written practice questions kept for reuse

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quiz_bank",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lang", sa.String(2), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("topic", sa.String(120), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("modelled_on", sa.JSON(), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("lang", "text_hash", name="uq_quiz_bank_lang_text"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_quiz_bank_lang", "quiz_bank", ["lang"])
    op.create_index("ix_quiz_bank_slot", "quiz_bank", ["slot"])


def downgrade() -> None:
    op.drop_table("quiz_bank")
