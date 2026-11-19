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
