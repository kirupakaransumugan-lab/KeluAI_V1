from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class QuizGenerationJob(Base):
    """One set of draft questions an admin asked the AI to write (app/services/quiz_jobs.py).
    It lives in the database so its progress and the one-set-a-day rule survive a restart."""

    __tablename__ = "quiz_generation_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    lang: Mapped[str] = mapped_column(String(2))
    status: Mapped[str] = mapped_column(String(12), default="running")   # running | finished | stopped | failed
    requested: Mapped[int] = mapped_column(SmallInteger)
    added: Mapped[int] = mapped_column(SmallInteger, default=0)          # drafts saved
    failed: Mapped[int] = mapped_column(SmallInteger, default=0)         # unusable or a duplicate
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
