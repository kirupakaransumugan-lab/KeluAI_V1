from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QuizBankQuestion(Base):
    """A stored question for the 10-question whole-syllabus quiz, served with no AI request.
    Subject quizzes are written live and never stored here.
    Written as drafts from the admin Quiz Bank page, published after review; served by POST /tutor/quiz/set."""

    __tablename__ = "quiz_bank"
    # The same question text twice in one language is one question (see text_hash).
    __table_args__ = (
        UniqueConstraint("lang", "text_hash", name="uq_quiz_bank_lang_text"),
        Index("ix_quiz_bank_lang_topic", "lang", "topic_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lang: Mapped[str] = mapped_column(String(2), index=True)          # "en" | "ta"
    slot: Mapped[int] = mapped_column(SmallInteger, index=True)       # its place when written; not used to serve
    topic: Mapped[str] = mapped_column(String(120))
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    steps: Mapped[list] = mapped_column(JSON)                         # [{title, options: [{text, why, correct}]}]
    modelled_on: Mapped[dict] = mapped_column(JSON)                   # citation of the past-paper style example
    text_hash: Mapped[str] = mapped_column(String(64))                # sha256 of the normalised question text
    # "draft" (an admin hasn't reviewed it: never served) or "published"
    status: Mapped[str] = mapped_column(String(12), default="published", server_default="published", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
