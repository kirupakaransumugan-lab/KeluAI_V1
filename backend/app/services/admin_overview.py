"""Numbers for the admin Overview page, from the users / student_profiles / subscriptions
tables, plus payments admins record. Anything the database does not record yet (AI usage,
learning progress) is deliberately absent: the page shows it as "not tracked", never as a number.

Counting happens in Python over the student rows. That is fine for thousands of students;
past that, move the counts into SQL GROUP BYs.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.models.payment import Payment
from app.models.user import Medium, Role, StudentProfile, Subscription, SubscriptionStatus, User
from app.services.plans import PAID_KEYS as PAID_PLANS     # monthly, until_exam, class

LATEST = 5
REVENUE_MONTHS = 6


def _students(db: Session, medium: Medium | None) -> list[User]:
    q = select(User).where(User.role == Role.student).options(
        selectinload(User.profile), selectinload(User.subscriptions))
    if medium:
        q = q.join(StudentProfile).where(StudentProfile.medium == medium)
    return list(db.scalars(q))


def _live(sub: Subscription, at: datetime, plans: tuple[str, ...]) -> bool:
    """Was `sub` running at `at`? (A cancelled one still counts until its end date.)"""
    return sub.plan in plans and sub.starts_at <= at < sub.ends_at


def _has_live(user: User, at: datetime, plans: tuple[str, ...]) -> bool:
    return any(_live(s, at, plans) for s in user.subscriptions)


def _conversion(students: list[User], start: datetime, end: datetime) -> float | None:
    """Of the trials that ended in [start, end), the share whose student then paid.
    None when no trial ended in the window (a 0% would be misleading)."""
    ended = converted = 0
    for u in students:
        for t in (s for s in u.subscriptions if s.plan == "trial" and start <= s.ends_at < end):
            ended += 1
            converted += any(p.plan in PAID_PLANS and p.starts_at >= t.starts_at for p in u.subscriptions)
    return round(100 * converted / ended, 1) if ended else None


def _kpi(value: float | None, previous: float | None) -> dict:
    change = None
    if value is not None and previous:            # no change % against 0 or "no data"
        change = round(100 * (value - previous) / previous, 1)
    return {"value": value, "previous": previous, "change_pct": change}


def plan_state(user: User, now: datetime) -> str:
    """trial | paid | expired | cancelled: the label shown beside a student."""
    if _has_live(user, now, PAID_PLANS):
        return "paid"
    if _has_live(user, now, ("trial",)):
        return "trial"
    if any(s.status == SubscriptionStatus.cancelled for s in user.subscriptions):
        return "cancelled"
    return "expired"


def overview(db: Session, *, days: int, medium: Medium | None, now: datetime | None = None) -> dict:
    now = now or utcnow()
    start, prev_start = now - timedelta(days=days), now - timedelta(days=2 * days)
    students = _students(db, medium)

    # Windows are (a, b]: times are stored to the second, so a signup in the same second as
    # `now` has created_at == now and must still count as new.
    def joined(a: datetime, b: datetime) -> int:
        return sum(a < u.created_at <= b for u in students)

    def live(at: datetime, plans: tuple[str, ...]) -> int:
        return sum(_has_live(u, at, plans) for u in students)

    # Signups per calendar day, oldest first, ending today (days with none included as 0).
    today = now.date()
    per_day = {today - timedelta(days=i): 0 for i in range(days)}
    for u in students:
        if u.created_at.date() in per_day:
            per_day[u.created_at.date()] += 1

    latest = sorted(students, key=lambda u: u.created_at, reverse=True)[:LATEST]

    # Payments (recorded by admins), for the same students the filter picked.
    by_id = {u.id: u for u in students}
    month0 = today.replace(day=1)
    for _ in range(REVENUE_MONTHS - 1):
        month0 = (month0 - timedelta(days=1)).replace(day=1)
    since = min(prev_start, datetime.combine(month0, datetime.min.time()))
    payments = [p for p in db.scalars(select(Payment).where(Payment.paid_at >= since)
                                      .order_by(Payment.paid_at.desc(), Payment.id.desc()))
                if p.user_id in by_id]
    months: dict[str, int] = {}
    d = month0
    while d <= today:
        months[d.strftime("%Y-%m")] = 0
        d = (d + timedelta(days=32)).replace(day=1)
    for p in payments:
        key = p.paid_at.strftime("%Y-%m")
        if key in months:
            months[key] += p.amount_lkr
    revenue = sum(p.amount_lkr for p in payments if start < p.paid_at <= now)
    revenue_before = sum(p.amount_lkr for p in payments if prev_start < p.paid_at <= start)
    return {
        "range": {"days": days, "medium": medium.value if medium else "all",
                  "from": start.isoformat(), "to": now.isoformat()},
        "kpis": {
            "total_students": _kpi(len(students), sum(u.created_at <= start for u in students)),
            "new_signups": _kpi(joined(start, now), joined(prev_start, start)),
            "active_trials": _kpi(live(now, ("trial",)), live(start, ("trial",))),
            "paid_subscribers": _kpi(live(now, PAID_PLANS), live(start, PAID_PLANS)),
            "revenue_lkr": _kpi(revenue, revenue_before),
            "trial_to_paid_pct": _kpi(_conversion(students, start, now), _conversion(students, prev_start, start)),
        },
        "signups_per_day": [{"date": d.isoformat(), "count": n} for d, n in sorted(per_day.items())],
        "latest_signups": [{
            "id": u.id, "full_name": u.full_name, "email": u.email,
            "medium": u.profile.medium.value if u.profile else None,
            "joined_at": u.created_at.isoformat(), "status": plan_state(u, now),
        } for u in latest],
        "revenue_per_month": [{"month": m, "amount_lkr": v} for m, v in months.items()],
        "latest_payments": [{
            "id": p.id, "full_name": by_id[p.user_id].full_name, "plan": p.plan, "amount_lkr": p.amount_lkr,
            "method": p.method, "paid_at": p.paid_at.isoformat(),
        } for p in payments[:LATEST]],
    }
