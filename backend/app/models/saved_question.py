from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class SavedQuestion(Base):
    """A practice question a student bookmarked, with its worked answer.

    Quiz questions are written by the AI in the browser and never stored elsewhere, so the
    text itself is saved. `question_hash` (sha256 of the text) makes saving twice a no-op."""

    __tablename__ = "saved_questions"
    __table_args__ = (
        UniqueConstraint("user_id", "question_hash", name="uq_saved_question_user_hash"),
        Index("ix_saved_questions_user_time", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_hash: Mapped[str] = mapped_column(String(64))
    topic: Mapped[str] = mapped_column(String(120))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
