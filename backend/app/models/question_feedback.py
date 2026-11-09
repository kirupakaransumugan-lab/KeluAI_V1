from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class QuestionFeedback(Base):
    """A student's report on a practice question: a mistake, or another way to solve it.
    Practice questions aren't stored, so the report keeps a copy of the one it is about.
    That copy comes from the student's browser, so an admin treats it as what they were shown."""

    __tablename__ = "question_feedback"
    __table_args__ = (Index("ix_question_feedback_status", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))                    # "mistake" | "method"
    message: Mapped[str] = mapped_column(Text)
    question_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)   # {topic, question, answer}
    # File name in var/feedback, cleared when the report is closed: no photo of a student's
    # work is kept longer than it takes to review it.
    image_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="open")  # "open" | "closed"
    ai_verdict: Mapped[str | None] = mapped_column(String(15), nullable=True)   # CONFIRMED | NOT_CONFIRMED | UNSURE
    ai_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
