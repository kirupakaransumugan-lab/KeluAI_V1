"""What plan a student is on, read from the subscriptions table.

Online payment isn't connected yet (PAYMENTS_ENABLED), so a plan only changes when an admin
adds a row. A row past its end date counts as expired even if its status was never updated.
"""
from __future__ import annotations

import math
from datetime import datetime

from app.core.clock import utcnow
from app.models.user import Subscription, SubscriptionStatus, User

PAYMENTS_ENABLED = False
# Keep in step with the public pricing page (frontend/src/pages/PricingPage.tsx).
PLANS = [
    {"key": "monthly", "price_lkr": 499, "period": "month"},
    {"key": "annual", "price_lkr": 4999, "period": "year"},
]
LIVE = (SubscriptionStatus.trialing, SubscriptionStatus.active)


def _status(s: Subscription, now: datetime) -> str:
    if s.status in LIVE and s.ends_at <= now:
        return SubscriptionStatus.expired.value
    return s.status.value


def _out(s: Subscription, now: datetime) -> dict:
    state = _status(s, now)
    live = state in (SubscriptionStatus.trialing.value, SubscriptionStatus.active.value)
    return {
        "id": s.id, "plan": s.plan, "status": state,
        "starts_at": f"{s.starts_at.isoformat()}Z", "ends_at": f"{s.ends_at.isoformat()}Z",
        "days_left": max(0, math.ceil((s.ends_at - now).total_seconds() / 86400)) if live else 0,
    }


def summary(user: User, now: datetime | None = None) -> dict:
    now = now or utcnow()
    rows = sorted(user.subscriptions, key=lambda s: s.starts_at, reverse=True)
    history = [_out(s, now) for s in rows]
    # The plan in force: a live paid plan beats a live trial; otherwise the newest row.
    live = [h for h in history if h["status"] in ("trialing", "active")]
    current = next((h for h in live if h["plan"] != "trial"), None) or (live[0] if live else None) \
        or (history[0] if history else None)
    return {"current": current, "history": history, "plans": PLANS, "payments_enabled": PAYMENTS_ENABLED}
