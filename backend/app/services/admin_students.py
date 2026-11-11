"""Admin > Students: the student list and one student's page.

Every number comes from tables the app already writes (users, profiles, subscriptions,
practice_answers), using the same rules as the student's own Progress page, so an admin
and the student always see the same figures.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.models.progress import PracticeAnswer
from app.models.user import Medium, Role, StudentProfile, User
from app.services import subscription
from app.services.admin_overview import plan_state
from app.services.progress import build_report, local_day

ACTIVITY_WEEKS = 3            # rows in the Study Activity grid: this week and the two before
LIST_LIMIT = 500


def _iso(at: datetime | None) -> str | None:
    return f"{at.isoformat()}Z" if at else None


def _student_query():
    return (select(User).where(User.role == Role.student)
            .options(selectinload(User.profile), selectinload(User.subscriptions)))


def _row(u: User, stats: tuple[int, datetime | None], now: datetime) -> dict:
    questions, last_at = stats
    return {
        "id": u.id, "full_name": u.full_name, "email": u.email, "mobile": u.mobile,
        "medium": u.profile.medium.value if u.profile else None,
        "al_exam_year": u.profile.al_exam_year if u.profile else None,
        "joined_at": _iso(u.created_at), "is_active": u.is_active,
        "plan_state": plan_state(u, now),            # trial | paid | expired | cancelled
        "questions": questions, "last_active_at": _iso(last_at),
    }


def list_students(db: Session, *, q: str = "", medium: Medium | None = None,
                  now: datetime | None = None) -> list[dict]:
    now = now or utcnow()
    query = _student_query().order_by(User.created_at.desc()).limit(LIST_LIMIT)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.mobile.ilike(like)))
    if medium:
        query = query.join(StudentProfile).where(StudentProfile.medium == medium)
    users = list(db.scalars(query))
    stats = {uid: (n, last) for uid, n, last in db.execute(
        select(PracticeAnswer.user_id, func.count(), func.max(PracticeAnswer.answered_at))
        .where(PracticeAnswer.user_id.in_([u.id for u in users]))
        .group_by(PracticeAnswer.user_id))} if users else {}
    return [_row(u, stats.get(u.id, (0, None)), now) for u in users]


def get_student(db: Session, user_id: int) -> User | None:
    return db.scalars(_student_query().where(User.id == user_id)).first()


def _activity(rows: list[PracticeAnswer], now: datetime) -> list[dict]:
    """ACTIVITY_WEEKS rows of Monday..Sunday, newest week first, with questions answered per day."""
    per_day = Counter(local_day(a.answered_at) for a in rows)
    today = local_day(now)
    monday = today - timedelta(days=today.weekday())
    weeks = []
    for back in range(ACTIVITY_WEEKS):
        start = monday - timedelta(weeks=back)
        weeks.append({"start": start.isoformat(), "days": [
            {"date": (d := start + timedelta(days=i)).isoformat(), "questions": per_day.get(d, 0),
             "future": d > today}
            for i in range(7)]})
    return weeks


def _sessions(rows: list[PracticeAnswer], limit: int = 20) -> list[dict]:
    """The latest practice sets and quizzes, newest first, for the Activity tab."""
    sets: dict[int, list[PracticeAnswer]] = defaultdict(list)
    for a in rows:
        sets[a.set_id].append(a)
    latest = sorted(sets.values(), key=lambda s: s[0].answered_at, reverse=True)[:limit]
    return [{
        "set_id": s[0].set_id, "kind": s[0].kind, "lang": s[0].lang, "at": _iso(s[0].answered_at),
        "questions": len(s), "perfect": sum(a.steps_right == a.steps_total for a in s),
        "topics": sorted({a.topic for a in s})[:3],
    } for s in latest]


def detail(db: Session, user: User, now: datetime | None = None) -> dict:
    now = now or utcnow()
    rows = list(db.scalars(select(PracticeAnswer).where(PracticeAnswer.user_id == user.id)
                           .order_by(PracticeAnswer.answered_at)))
    stats = (len(rows), rows[-1].answered_at if rows else None)
    report = build_report(db, user, days=None, now=now)
    return {
        "student": {**_row(user, stats, now), "parent_email": user.profile.parent_email if user.profile else None,
                    "has_password": user.password_hash is not None, "google": user.google_sub is not None,
                    "microsoft": user.microsoft_sub is not None},
        "progress": {k: report[k] for k in ("has_answers", "mastery", "topics_covered", "accuracy", "streak",
                                            "weekly", "topics", "recent")},
        "activity": _activity(rows, now),
        "sessions": _sessions(rows),
        "subscription": subscription.summary(user, now),
    }
