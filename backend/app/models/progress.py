from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class PracticeAnswer(Base):
    """One question a student finished in a practice set, written when the set is submitted.

    `topic` is the raw name from the question, classified when a report is read
    (app/services/topics.py), so improving the mapping also corrects past answers."""

    __tablename__ = "practice_answers"
    __table_args__ = (
        # A set can only be saved once, however often the browser retries.
        UniqueConstraint("user_id", "set_id", "slot", name="uq_practice_answer_set_slot"),
        Index("ix_practice_answers_user_time", "user_id", "answered_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    set_id: Mapped[int] = mapped_column(BigInteger)                 # the browser's id for the set
    kind: Mapped[str] = mapped_column(String(20), default="practice")
    lang: Mapped[str] = mapped_column(String(2))                    # "en" | "ta"
    slot: Mapped[int] = mapped_column(SmallInteger)                 # question number in the set
    topic: Mapped[str] = mapped_column(String(120))
    steps_total: Mapped[int] = mapped_column(SmallInteger)
    steps_right: Mapped[int] = mapped_column(SmallInteger)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
