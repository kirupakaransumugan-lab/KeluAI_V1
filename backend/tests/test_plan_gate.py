"""Once a student's trial (or paid plan) has ended, the study features answer 402 plan_ended."""
from datetime import timedelta
from types import SimpleNamespace as NS

import pytest
from fastapi import HTTPException

from app.core.clock import utcnow
from app.core.dependencies import require_live_plan
from app.models.user import Role, SubscriptionStatus


def _sub(plan: str, days_left: int, status=SubscriptionStatus.trialing):
    now = utcnow()
    return NS(plan=plan, status=status, starts_at=now - timedelta(days=30), ends_at=now + timedelta(days=days_left))


def _student(*subs):
    return NS(id=1, role=Role.student, subscriptions=list(subs))


@pytest.mark.parametrize("user", [
    _student(_sub("trial", 3)),
    _student(_sub("trial", -1), _sub("monthly", 10, SubscriptionStatus.active)),
    NS(id=2, role=Role.admin, subscriptions=[]),
])
def test_live_plan_or_admin_passes(user):
    assert require_live_plan(user) is user


@pytest.mark.parametrize("user", [
    _student(_sub("trial", -1)),                                            # trial over
    _student(_sub("monthly", -2, SubscriptionStatus.cancelled)),            # cancelled and ended
    _student(),                                                             # never had a plan
])
def test_ended_plan_is_402(user):
    with pytest.raises(HTTPException) as e:
        require_live_plan(user)
    assert e.value.status_code == 402
    assert e.value.detail == {"code": "plan_ended"}
