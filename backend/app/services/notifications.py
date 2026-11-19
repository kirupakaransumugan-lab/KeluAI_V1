"""The student's notification bell: alerts worked out from data already stored, so nothing new
is saved. Each alert has a stable `id` and a time `at`; the browser remembers when the bell was
last opened and lights the dot only for alerts newer than that.

The server sends a `kind` and its numbers, never sentences: the page words them in the
student's language (English or Tamil).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.payment import Payment
from app.models.question_feedback import QuestionFeedback
from app.models.user import Subscription, SubscriptionStatus, User
from app.services import usage_limits
from app.services.progress import COLOMBO, local_day
from app.services.quiz_plan import EXAM_DAY, EXAM_MONTH, EXAM_WINDOW_MONTHS, can_take_full_quiz

RECENT = timedelta(days=14)        # how far back payments and closed reports are shown


def _plan_alert(user: User, now: datetime) -> dict | None:
    """A warning that the student's plan (trial or paid) ends soon, or has just ended."""
    # TODO(human)
    return None


def _payment_alerts(db: Session, user: User, now: datetime) -> list[dict]:
    rows = db.scalars(select(Payment).where(Payment.user_id == user.id, Payment.created_at >= now - RECENT))
    return [{"id": f"payment:{p.id}", "kind": "payment", "at": p.created_at,
             "data": {"plan": p.plan, "amount_lkr": p.amount_lkr}} for p in rows]


def _feedback_alerts(db: Session, user: User, now: datetime) -> list[dict]:
    rows = db.scalars(select(QuestionFeedback).where(
        QuestionFeedback.user_id == user.id, QuestionFeedback.status == "closed",
        QuestionFeedback.resolved_at >= now - RECENT))
    return [{"id": f"feedback:{f.id}", "kind": "feedback_closed", "at": f.resolved_at,
             "data": {"topic": (f.question_snapshot or {}).get("topic") or "", "verdict": f.ai_verdict}}
            for f in rows]


def _full_quiz_alert(user: User) -> dict | None:
    """The 10-question quiz unlocks in exam year; dated from when its window opened."""
    profile = user.profile
    if not profile or not profile.al_exam_year or not can_take_full_quiz(user):
        return None
    opens = profile.al_exam_year * 12 + (EXAM_MONTH - 1) - EXAM_WINDOW_MONTHS
    opened = datetime.combine(date(opens // 12, opens % 12 + 1, EXAM_DAY), datetime.min.time()) - COLOMBO
    return {"id": f"full_quiz:{profile.al_exam_year}", "kind": "full_quiz_unlocked", "at": opened, "data": {}}


def _limit_alert(db: Session, user: User, now: datetime) -> dict | None:
    """Free students who used today's topic quizzes; gone tomorrow, when the count resets."""
    quiz = usage_limits.status(db, user, now)["quiz"]
    if quiz["limit"] is None or quiz["used"] < quiz["limit"]:
        return None
    day = local_day(now)
    return {"id": f"quiz_limit:{day.isoformat()}", "kind": "quiz_limit", "at":
            datetime.combine(day, datetime.min.time()) - COLOMBO, "data": {"limit": quiz["limit"]}}


def for_student(db: Session, user: User, now: datetime | None = None) -> list[dict]:
    """Newest first."""
    now = now or utcnow()
    items = [_plan_alert(user, now), _full_quiz_alert(user), _limit_alert(db, user, now),
             *_payment_alerts(db, user, now), *_feedback_alerts(db, user, now)]
    items = [i for i in items if i]
    items.sort(key=lambda i: i["at"], reverse=True)
    return items
