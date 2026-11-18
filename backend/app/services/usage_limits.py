"""Daily limits for free students: FREE_LIMITS chat messages and practice quizzes a day.

Free = a student without a live paid plan (a trial counts as free). Paid students and admins
have no limit. The day is the Sri Lanka calendar day, the same as streaks and the daily quiz.

Checked before the AI is called, recorded only after it answered, so a failed AI call never
uses up a student's allowance. A quiz counts once, on its first written question; its other
questions are free (they share its `quiz_id`).
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.daily_usage import DailyUsage
from app.models.user import Role, User
from app.services.admin_overview import plan_state
from app.services.progress import local_day

FREE_LIMITS = {"chat": 20, "quiz": 2}   # quiz = a 5-question topic quiz; the exam-year 10-question quiz isn't limited here


class LimitReached(Exception):
    def __init__(self, kind: str, limit: int):
        super().__init__(kind)
        self.kind = kind
        self.limit = limit


def is_limited(user: User, now: datetime | None = None) -> bool:
    return user.role == Role.student and plan_state(user, now or utcnow()) != "paid"


def _today(now: datetime | None) -> date:
    return local_day(now or utcnow())


def _used(db: Session, user_id: int, kind: str, day: date) -> int:
    return db.scalar(select(func.count()).select_from(DailyUsage)
                     .where(DailyUsage.user_id == user_id, DailyUsage.day == day, DailyUsage.kind == kind)) or 0


def status(db: Session, user: User, now: datetime | None = None) -> dict:
    """What a student has used today and their limits (None = unlimited)."""
    limited = is_limited(user, now)
    day = _today(now)
    return {kind: {"used": _used(db, user.id, kind, day), "limit": limit if limited else None}
            for kind, limit in FREE_LIMITS.items()}


def check(db: Session, user: User, kind: str, ref: int | None = None, now: datetime | None = None) -> None:
    """Raise LimitReached if this would go over today's limit. A quiz already counted today
    (same ref) is always allowed: its other questions don't count again."""
    if not is_limited(user, now):
        return
    day = _today(now)
    if ref is not None and db.scalar(select(DailyUsage.id).where(
            DailyUsage.user_id == user.id, DailyUsage.day == day, DailyUsage.kind == kind, DailyUsage.ref == ref)):
        return
    if _used(db, user.id, kind, day) >= FREE_LIMITS[kind]:
        raise LimitReached(kind, FREE_LIMITS[kind])


def record(db: Session, user: User, kind: str, ref: int | None = None, now: datetime | None = None) -> None:
    """Count one use (after the AI answered). A quiz's second question onward is a no-op."""
    db.add(DailyUsage(user_id=user.id, day=_today(now), kind=kind, ref=ref))
    try:
        db.commit()
    except IntegrityError:          # this quiz is already counted today
        db.rollback()
