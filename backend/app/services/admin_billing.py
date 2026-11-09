"""Admin > Subscriptions & Payments.

Online payment isn't connected (subscription.PAYMENTS_ENABLED), so an admin records each
payment by hand: that adds a payment row and the paid subscription it buys. A renewal starts
when the student's current paid plan ends, so paying early never loses days.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.models.payment import Payment
from app.models.user import Role, Subscription, SubscriptionStatus, User
from app.services.admin_overview import PAID_PLANS, plan_state
from app.services.subscription import PLANS, summary

PLAN_DAYS = {"monthly": 30, "annual": 365}
METHODS = ("bank_transfer", "cash", "card", "other")
EXPIRING_DAYS = 7
REVENUE_DAYS = 30
LIST_LIMIT = 500
PAYMENTS_SHOWN = 200


class BillingError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _iso(at: datetime | None) -> str | None:
    return f"{at.isoformat()}Z" if at else None


def _students(db: Session, q: str) -> list[User]:
    query = (select(User).where(User.role == Role.student)
             .options(selectinload(User.profile), selectinload(User.subscriptions))
             .order_by(User.created_at.desc()).limit(LIST_LIMIT))
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.mobile.ilike(like)))
    return list(db.scalars(query))


def _payment_out(p: Payment, people: dict[int, User]) -> dict:
    student, admin = people.get(p.user_id), people.get(p.recorded_by_id or 0)
    return {
        "id": p.id, "user_id": p.user_id, "student": student.full_name if student else "—",
        "email": student.email if student else None, "plan": p.plan, "amount_lkr": p.amount_lkr,
        "method": p.method, "reference": p.reference, "note": p.note, "paid_at": _iso(p.paid_at),
        "recorded_by": admin.full_name if admin else None,
    }


def _ends(row: dict) -> datetime:
    return datetime.fromisoformat(row["current"]["ends_at"].rstrip("Z"))


def overview(db: Session, *, q: str = "", now: datetime | None = None) -> dict:
    now = now or utcnow()
    rows = []
    for u in _students(db, q):
        rows.append({"user_id": u.id, "full_name": u.full_name, "email": u.email, "is_active": u.is_active,
                     "state": plan_state(u, now), "current": summary(u, now)["current"]})

    soon = now + timedelta(days=EXPIRING_DAYS)
    expiring = [r for r in rows if r["state"] in ("paid", "trial") and r["current"] and _ends(r) <= soon]
    revenue_30 = db.scalar(select(func.coalesce(func.sum(Payment.amount_lkr), 0))
                           .where(Payment.paid_at >= now - timedelta(days=REVENUE_DAYS)))
    revenue_all = db.scalar(select(func.coalesce(func.sum(Payment.amount_lkr), 0)))

    payments = list(db.scalars(select(Payment).order_by(Payment.paid_at.desc(), Payment.id.desc())
                               .limit(PAYMENTS_SHOWN)))
    ids = {p.user_id for p in payments} | {p.recorded_by_id for p in payments if p.recorded_by_id}
    people = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids)))} if ids else {}
    return {
        "kpis": {
            "paid": sum(r["state"] == "paid" for r in rows),
            "trials": sum(r["state"] == "trial" for r in rows),
            "expiring": len(expiring),
            "ended": sum(r["state"] in ("expired", "cancelled") for r in rows),
            "revenue_30d": int(revenue_30), "revenue_total": int(revenue_all),
        },
        "subscriptions": rows,
        "payments": [_payment_out(p, people) for p in payments],
        "plans": PLANS, "methods": list(METHODS),
        "expiring_days": EXPIRING_DAYS, "revenue_days": REVENUE_DAYS, "limit": LIST_LIMIT,
    }


def _student(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.role != Role.student:
        raise BillingError("student_not_found")
    return user


def record_payment(db: Session, admin: User, *, user_id: int, plan: str, amount_lkr: int, method: str,
                   reference: str | None = None, note: str | None = None, paid_at: datetime | None = None,
                   now: datetime | None = None) -> Payment:
    now = now or utcnow()
    if plan not in PLAN_DAYS:
        raise BillingError("bad_plan")
    if method not in METHODS:
        raise BillingError("bad_method")
    user = _student(db, user_id)
    # Renewing early: the new plan starts when the running paid plan ends.
    running = [s.ends_at for s in user.subscriptions
               if s.plan in PAID_PLANS and s.status != SubscriptionStatus.cancelled and s.ends_at > now]
    starts = max([now, *running])
    sub = Subscription(user_id=user.id, plan=plan, status=SubscriptionStatus.active,
                       starts_at=starts, ends_at=starts + timedelta(days=PLAN_DAYS[plan]))
    db.add(sub)
    db.flush()
    payment = Payment(user_id=user.id, subscription_id=sub.id, plan=plan, amount_lkr=amount_lkr, method=method,
                      reference=(reference or "").strip() or None, note=(note or "").strip() or None,
                      paid_at=paid_at or now, recorded_by_id=admin.id)
    db.add(payment)
    db.commit()
    return payment


def remove_payment(db: Session, payment_id: int) -> None:
    """Undo a payment recorded by mistake, together with the plan it started."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        return
    if payment.subscription_id:
        sub = db.get(Subscription, payment.subscription_id)
        if sub is not None:
            db.delete(sub)
    db.delete(payment)
    db.commit()


def extend_trial(db: Session, user_id: int, days: int, now: datetime | None = None) -> dict:
    now = now or utcnow()
    user = _student(db, user_id)
    trial = max((s for s in user.subscriptions if s.plan == "trial"), key=lambda s: s.starts_at, default=None)
    if trial is None:
        trial = Subscription(user_id=user.id, plan="trial", status=SubscriptionStatus.trialing,
                             starts_at=now, ends_at=now)
        db.add(trial)
    # A trial that has ended restarts from today; a running one just gets longer.
    trial.ends_at = max(trial.ends_at, now) + timedelta(days=days)
    trial.status = SubscriptionStatus.trialing
    db.commit()
    db.refresh(user)
    return summary(user, now)


def cancel_subscription(db: Session, sub_id: int, now: datetime | None = None) -> dict:
    """End a plan now (a refund, misuse...). The row stays in the history as cancelled."""
    now = now or utcnow()
    sub = db.get(Subscription, sub_id)
    if sub is None or sub.user.role != Role.student:
        raise BillingError("subscription_not_found")
    sub.status = SubscriptionStatus.cancelled
    sub.ends_at = min(sub.ends_at, now)
    db.commit()
    db.refresh(sub.user)
    return summary(sub.user, now)
