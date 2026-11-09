"""quiz topics: the topics a student chose for their preference quizzes

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("student_profiles", sa.Column("quiz_topics", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("student_profiles", "quiz_topics")
