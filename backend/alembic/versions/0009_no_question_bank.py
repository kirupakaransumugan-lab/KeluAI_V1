"""reports keep their own question copy; remove approved methods and saved topic preferences

Subject quizzes are written fresh and never saved, so a report can no longer point at a bank row:
it keeps its own copy of the question. quiz_bank and quiz_generation_jobs stay, for the stored
10-question whole-syllabus quiz. A student's marks are in practice_answers, untouched here.

This drops data, so it can't be undone by a downgrade.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for fk in sa.inspect(op.get_bind()).get_foreign_keys("question_feedback"):
        if fk["constrained_columns"] == ["question_id"]:
            op.drop_constraint(fk["name"], "question_feedback", type_="foreignkey")
    op.drop_index("ix_question_feedback_question_id", table_name="question_feedback")
    op.drop_column("question_feedback", "question_id")
    op.drop_column("question_feedback", "ai_suggestion")
    op.add_column("question_feedback", sa.Column("question_snapshot", sa.JSON(), nullable=True))

    op.drop_table("quiz_question_methods")
    op.drop_table("student_topic_preferences")


def downgrade() -> None:
    raise NotImplementedError("0009 drops data: restore from a database backup instead.")
