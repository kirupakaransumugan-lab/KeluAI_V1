from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class DailyUsage(Base):
    """One AI-backed thing a student used on a Sri Lanka calendar day: a tutor chat message
    (`kind` "chat") or a practice quiz (`kind` "quiz", `ref` = the browser's quiz id, so the
    five questions of one quiz count once). Free students have daily limits on both
    (app/services/usage_limits.py)."""

    __tablename__ = "daily_usage"
    __table_args__ = (
        # A quiz is counted once however many of its questions are written; chat rows have
        # no ref (NULL), and NULLs never clash, so every message is its own row.
        UniqueConstraint("user_id", "day", "kind", "ref", name="uq_daily_usage_ref"),
        Index("ix_daily_usage_user_day", "user_id", "day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(10))                 # "chat" | "quiz"
    ref: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
