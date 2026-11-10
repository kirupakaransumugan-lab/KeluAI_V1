"""The price list: Free, Monthly, Until exam and Class plan.

Keys and billing kinds are fixed here because subscriptions and payments store the key and
the end date depends on the kind. Names, prices, descriptions and visibility are data: an
admin edits them on Admin > Plans, which saves a row in `plans` over these defaults.

Online payment isn't connected yet, so a paid plan starts when an admin records a payment
(app/services/admin_billing.py). The free plan is never bought: a student with no live paid
plan is on it.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.user import Role, Subscription, SubscriptionStatus, User

# billing: free | month (30 days) | until_exam (to the student's A/L) | student_month (a teacher
# pays per student; recorded on each student for 30 days).
DEFAULTS: tuple[dict, ...] = (
    {"key": "free", "billing": "free", "price_lkr": 0, "is_visible": True, "highlight": False,
     "name_en": "Free", "name_ta": "இலவசம்",
     "blurb_en": "Diagnostic, daily quiz and one marked paper a week.",
     "blurb_ta": "ஆரம்ப மதிப்பீடு, தினசரி வினாடி வினா, வாரத்துக்கு ஒரு திருத்திய வினாத்தாள்."},
    {"key": "monthly", "billing": "month", "price_lkr": 1500, "is_visible": True, "highlight": False,
     "name_en": "Monthly", "name_ta": "மாதாந்தம்",
     "blurb_en": "Full tutor, practice and tests; 40 written markings a month.",
     "blurb_ta": "முழு AI ஆசிரியர், பயிற்சி, பரீட்சைகள்; மாதம் 40 எழுத்து விடைத் திருத்தங்கள்."},
    {"key": "until_exam", "billing": "until_exam", "price_lkr": 12000, "is_visible": True, "highlight": True,
     "name_en": "Until exam", "name_ta": "பரீட்சை வரை",
     "blurb_en": "About LKR 1,200 a month over ten months.",
     "blurb_ta": "பத்து மாதங்களுக்கு மாதம் சுமார் LKR 1,200."},
    {"key": "class", "billing": "student_month", "price_lkr": 1000, "is_visible": True, "highlight": False,
     "name_en": "Class plan", "name_ta": "வகுப்புத் திட்டம்",
     "blurb_en": "For tuition teachers, with a class dashboard.",
     "blurb_ta": "தனியார் வகுப்பு ஆசிரியர்களுக்கு, வகுப்பு முகாமைத்துவப் பலகையுடன்."},
)
KEYS = tuple(d["key"] for d in DEFAULTS)
PAID_KEYS = tuple(d["key"] for d in DEFAULTS if d["billing"] != "free")
BILLING = {d["key"]: d["billing"] for d in DEFAULTS}
EDITABLE = ("name_en", "name_ta", "price_lkr", "blurb_en", "blurb_ta", "is_visible", "highlight")
MONTH_DAYS = 30
REVENUE_DAYS = 30


class PlanError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _iso(at: datetime | None) -> str | None:
    return f"{at.isoformat()}Z" if at else None


def _merge(default: dict, row: Plan | None) -> dict:
    plan = dict(default)
    if row is not None:
        plan.update({f: getattr(row, f) for f in EDITABLE})
    plan["updated_at"] = _iso(row.updated_at) if row is not None else None
    return plan


def list_plans(db: Session | None, *, visible_only: bool = False) -> list[dict]:
    """Every plan in price-list order. `db=None` gives the defaults (an object with no session)."""
    rows = {p.key: p for p in db.scalars(select(Plan))} if db is not None else {}
    plans = [_merge(d, rows.get(d["key"])) for d in DEFAULTS]
    return [p for p in plans if p["is_visible"]] if visible_only else plans


def update_plan(db: Session, admin: User, key: str, changes: dict) -> dict:
    if key not in KEYS:
        raise PlanError("plan_not_found")
    changes = {k: v for k, v in changes.items() if k in EDITABLE and v is not None}
    if key == "free" and changes.get("price_lkr", 0) != 0:
        raise PlanError("free_has_no_price")
    for text in ("name_en", "name_ta"):
        if text in changes and not changes[text].strip():
            raise PlanError("name_required")

    rows = {p.key: p for p in db.scalars(select(Plan))}

    def row_for(k: str) -> Plan:
        if k not in rows:
            default = next(d for d in DEFAULTS if d["key"] == k)
            rows[k] = Plan(key=k, **{f: default[f] for f in EDITABLE})
            db.add(rows[k])
        return rows[k]

    row = row_for(key)
    for field, value in changes.items():
        setattr(row, field, value.strip() if isinstance(value, str) else value)
    row.updated_by_id = admin.id
    row.updated_at = utcnow()
    if changes.get("highlight"):
        # One "best value" card: highlighting this plan un-highlights the others.
        for other in KEYS:
            if other != key and _merge(next(d for d in DEFAULTS if d["key"] == other), rows.get(other))["highlight"]:
                row_for(other).highlight = False
    db.commit()
    return _merge(next(d for d in DEFAULTS if d["key"] == key), row)


def until_exam_ends(user: User, starts: datetime) -> datetime:
    """When an "Until exam" plan bought by `user`, starting at `starts` (naive UTC), ends.

    The A/L runs from late November into December, so the plan lasts to the end of 31 December
    of the student's exam year, Sri Lanka time (18:29:59 UTC). A student whose exam is already
    over gets that past date, which record_payment refuses as "plan_already_over"."""
    if user.profile is None:
        raise PlanError("no_exam_year")
    return datetime(user.profile.al_exam_year, 12, 31, 18, 29, 59)


def plan_ends(key: str, user: User, starts: datetime) -> datetime:
    billing = BILLING.get(key)
    if billing in ("month", "student_month"):
        return starts + timedelta(days=MONTH_DAYS)
    if billing == "until_exam":
        return until_exam_ends(user, starts)
    raise PlanError("bad_plan")          # free is never bought


def _live_paid_plan(user: User, now: datetime) -> str | None:
    live = [s for s in user.subscriptions
            if s.plan in PAID_KEYS and s.status in (SubscriptionStatus.active, SubscriptionStatus.trialing)
            and s.starts_at <= now < s.ends_at]
    return max(live, key=lambda s: s.starts_at).plan if live else None


def admin_overview(db: Session, now: datetime | None = None) -> dict:
    """Admin > Plans: every plan, with how many students are on it now and what it has earned."""
    now = now or utcnow()
    students = db.scalars(select(User).where(User.role == Role.student)
                          .options(selectinload(User.subscriptions))).all()
    on_plan = dict.fromkeys(KEYS, 0)
    for u in students:
        on_plan[_live_paid_plan(u, now) or "free"] += 1

    def revenue(since: datetime | None) -> dict[str, int]:
        q = select(Payment.plan, func.coalesce(func.sum(Payment.amount_lkr), 0), func.count()).group_by(Payment.plan)
        if since is not None:
            q = q.where(Payment.paid_at >= since)
        return {plan: (int(total), int(n)) for plan, total, n in db.execute(q)}

    total, recent = revenue(None), revenue(now - timedelta(days=REVENUE_DAYS))
    plans = []
    for p in list_plans(db):
        plans.append({**p, "students": on_plan[p["key"]],
                      "revenue_total": total.get(p["key"], (0, 0))[0], "payments": total.get(p["key"], (0, 0))[1],
                      "revenue_30d": recent.get(p["key"], (0, 0))[0]})
    return {"plans": plans, "students": len(students), "revenue_days": REVENUE_DAYS}
