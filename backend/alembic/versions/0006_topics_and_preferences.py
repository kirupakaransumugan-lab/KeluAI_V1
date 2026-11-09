"""topics and student_topic_preferences tables; quiz bank questions filed by topic

Replaces student_profiles.quiz_topics (any saved choices are copied across).

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

from app.services.topics import TOPICS, by_key, classify

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    topics = op.create_table(
        "topics",
        sa.Column("id", sa.SmallInteger(), primary_key=True, autoincrement=False),
        sa.Column("key", sa.String(40), nullable=False, unique=True),
        sa.Column("strand", sa.String(10), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=False),
        sa.Column("name_ta", sa.String(120), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.bulk_insert(topics, [{"id": t.id, "key": t.key, "strand": t.strand, "name_en": t.en, "name_ta": t.ta,
                             "chunk_count": 0} for t in TOPICS])

    prefs = op.create_table(
        "student_topic_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("topic_id", sa.SmallInteger(), sa.ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    conn = op.get_bind()
    profiles = sa.table("student_profiles", sa.column("user_id", sa.Integer()), sa.column("quiz_topics", sa.JSON()))
    rows = []
    for user_id, keys in conn.execute(sa.select(profiles.c.user_id, profiles.c.quiz_topics)):
        for key in dict.fromkeys(keys or []):
            if by_key(key):
                rows.append({"user_id": user_id, "topic_id": by_key(key).id})
    if rows:
        conn.execute(prefs.insert(), rows)
    op.drop_column("student_profiles", "quiz_topics")

    op.add_column("quiz_bank", sa.Column("topic_id", sa.SmallInteger(), nullable=True))
    op.create_foreign_key("fk_quiz_bank_topic", "quiz_bank", "topics", ["topic_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_quiz_bank_lang_topic", "quiz_bank", ["lang", "topic_id"])
    bank = sa.table("quiz_bank", sa.column("id", sa.Integer()), sa.column("topic", sa.String()),
                    sa.column("topic_id", sa.SmallInteger()))
    for qid, name in conn.execute(sa.select(bank.c.id, bank.c.topic)).fetchall():
        topic = classify(name)
        if topic:
            conn.execute(bank.update().where(bank.c.id == qid).values(topic_id=topic.id))


def downgrade() -> None:
    op.drop_index("ix_quiz_bank_lang_topic", table_name="quiz_bank")
    op.drop_constraint("fk_quiz_bank_topic", "quiz_bank", type_="foreignkey")
    op.drop_column("quiz_bank", "topic_id")
    op.add_column("student_profiles", sa.Column("quiz_topics", sa.JSON(), nullable=True))
    op.drop_table("student_topic_preferences")
    op.drop_table("topics")
