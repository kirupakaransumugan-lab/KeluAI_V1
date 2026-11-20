"""The student's bell: alerts worked out from stored data (app/services/notifications.py)."""
from datetime import timedelta

from app.core.clock import utcnow
from app.core.database import get_db
from app.main import app
from app.models import DailyUsage
from app.models.payment import Payment
from app.models.question_feedback import QuestionFeedback
from app.repositories import user_repository
from app.services.progress import local_day
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

URL = "/api/v1/notifications"
EMAIL = "kavin@example.com"


def _db():
    return next(app.dependency_overrides[get_db]())


def _student(client):
    register(client, EMAIL)
    login(client, EMAIL)
    db = _db()
    return db, user_repository.get_by_email(db, EMAIL)


def _kinds(client):
    return [i["kind"] for i in client.get(URL).json()["items"]]


def test_needs_login(client):
    assert client.get(URL).status_code == 401


def test_admins_get_nothing(client):
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    assert client.get(URL).json() == {"items": []}


def test_recent_payment_shows_and_old_one_doesnt(client):
    db, user = _student(client)
    now = utcnow()
    db.add_all([Payment(user_id=user.id, plan="monthly", amount_lkr=1500, method="cash", paid_at=now, created_at=now),
                Payment(user_id=user.id, plan="monthly", amount_lkr=1500, method="cash",
                        paid_at=now - timedelta(days=30), created_at=now - timedelta(days=30))])
    db.commit()
    items = [i for i in client.get(URL).json()["items"] if i["kind"] == "payment"]
    assert len(items) == 1 and items[0]["data"] == {"plan": "monthly", "amount_lkr": 1500}
    assert items[0]["at"].endswith("Z")


def test_closed_report_shows_open_one_doesnt(client):
    db, user = _student(client)
    snap = {"topic": "Limits", "question": "q", "answer": "a"}
    db.add_all([QuestionFeedback(user_id=user.id, kind="mistake", message="m", question_snapshot=snap,
                                 status="closed", resolved_at=utcnow()),
                QuestionFeedback(user_id=user.id, kind="mistake", message="m", question_snapshot=snap)])
    db.commit()
    items = [i for i in client.get(URL).json()["items"] if i["kind"] == "feedback_closed"]
    assert len(items) == 1 and items[0]["data"]["topic"] == "Limits"


def test_quiz_limit_used_up_today(client):
    db, user = _student(client)
    assert "quiz_limit" not in _kinds(client)
    for ref in (1, 2):
        db.add(DailyUsage(user_id=user.id, day=local_day(utcnow()), kind="quiz", ref=ref))
    db.commit()
    assert "quiz_limit" in _kinds(client)


def test_newest_first(client):
    db, user = _student(client)
    now = utcnow()
    for days in (3, 1, 2):
        db.add(Payment(user_id=user.id, plan="monthly", amount_lkr=days, method="cash",
                       paid_at=now, created_at=now - timedelta(days=days)))
    db.commit()
    at = [i["at"] for i in client.get(URL).json()["items"]]
    assert at == sorted(at, reverse=True)


# ---------- Plan ending / ended (unit: _plan_alert) ----------

from datetime import datetime  # noqa: E402
from types import SimpleNamespace as NS  # noqa: E402

from app.services.notifications import _plan_alert  # noqa: E402

NOW = datetime(2026, 11, 20, 6, 0)          # UTC; 11:30 in Sri Lanka, 20 Nov


def _plan(ends: datetime, plan="trial", sid=1):
    return NS(id=sid, plan=plan, starts_at=datetime(2026, 11, 1), ends_at=ends)


def _alert(*subs):
    return _plan_alert(NS(subscriptions=list(subs)), NOW)


def test_no_warning_more_than_three_days_out():
    assert _alert(_plan(datetime(2026, 11, 24, 6, 0))) is None          # 24 Nov: 4 days


def test_warning_three_days_before_with_the_exact_end():
    alert = _alert(_plan(datetime(2026, 11, 23, 9, 0)))                  # 23 Nov, 14:30 LK
    assert alert["kind"] == "plan_ending"
    assert alert["data"] == {"plan": "trial", "days": 3, "ends_at": "2026-11-23T09:00:00Z"}


def test_ending_later_today_is_zero_days():
    assert _alert(_plan(datetime(2026, 11, 20, 12, 0)))["data"]["days"] == 0


def test_ended_trial_shows_its_date_then_fades():
    alert = _alert(_plan(datetime(2026, 11, 19, 6, 0)))
    assert alert["kind"] == "plan_ended" and alert["data"]["ends_at"] == "2026-11-19T06:00:00Z"
    assert _alert(_plan(datetime(2026, 10, 30))) is None                 # over 14 days ago


def test_a_paid_plan_after_the_trial_hides_the_trial_warning():
    assert _alert(_plan(datetime(2026, 11, 21)), _plan(datetime(2026, 12, 20), "monthly", 2)) is None
