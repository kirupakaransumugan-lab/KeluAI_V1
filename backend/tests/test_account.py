"""Saved questions, the subscription summary, and the settings endpoints (profile, password, delete)."""
from datetime import datetime, timedelta

from app.core.database import get_db
from app.main import app
from app.models import PracticeAnswer, SavedQuestion, StudentProfile, Subscription, User
from app.models.user import SubscriptionStatus
from app.schemas.auth import allowed_exam_years
from app.services.subscription import summary

PASSWORD = "s3cure-pass"


def _register(client, email="kavin@example.com"):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Kavin Raj", "email": email, "mobile": "0771234567", "password": PASSWORD,
        "medium": "ta", "al_exam_year": allowed_exam_years()[1], "accept_terms": True,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["user"]


def _db():
    gen = app.dependency_overrides[get_db]()
    return next(gen)


Q = {"topic": "Limits", "question": "Find lim x→0 sin x / x", "answer": "1"}


# ---------- Saved questions ----------

def test_saved_questions_need_login(client):
    assert client.get("/api/v1/saved-questions").status_code == 401
    assert client.post("/api/v1/saved-questions", json=Q).status_code == 401


def test_saving_twice_keeps_one_and_lists_newest_first(client):
    _register(client)
    first = client.post("/api/v1/saved-questions", json=Q)
    again = client.post("/api/v1/saved-questions", json=Q)
    assert first.status_code == 201 and again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    client.post("/api/v1/saved-questions", json={**Q, "question": "Second"})
    listed = client.get("/api/v1/saved-questions").json()["questions"]
    assert [q["question"] for q in listed] == ["Second", Q["question"]]


def test_delete_only_touches_your_own_questions(client):
    _register(client)
    saved_id = client.post("/api/v1/saved-questions", json=Q).json()["id"]
    client.post("/api/v1/auth/logout")
    _register(client, email="other@example.com")
    assert client.delete(f"/api/v1/saved-questions/{saved_id}").status_code == 404
    assert _db().query(SavedQuestion).count() == 1


def test_delete_removes_it(client):
    _register(client)
    saved_id = client.post("/api/v1/saved-questions", json=Q).json()["id"]
    assert client.delete(f"/api/v1/saved-questions/{saved_id}").status_code == 204
    assert client.get("/api/v1/saved-questions").json()["questions"] == []


def test_import_skips_repeats(client):
    _register(client)
    client.post("/api/v1/saved-questions", json=Q)
    body = {"questions": [Q, {**Q, "question": "New one"}]}
    assert client.post("/api/v1/saved-questions/import", json=body).json() == {"added": 1}
    assert len(client.get("/api/v1/saved-questions").json()["questions"]) == 2


# ---------- Subscription ----------

def test_new_student_is_on_the_trial(client):
    _register(client)
    body = client.get("/api/v1/subscription").json()
    assert body["current"]["plan"] == "trial" and body["current"]["status"] == "trialing"
    assert body["current"]["days_left"] in (13, 14)
    assert body["payments_enabled"] is False
    assert [p["key"] for p in body["plans"]] == ["free", "monthly", "until_exam", "class"]


def test_a_plan_past_its_end_counts_as_expired():
    now = datetime(2026, 11, 9)
    user = User(subscriptions=[Subscription(plan="trial", status=SubscriptionStatus.trialing,
                                            starts_at=now - timedelta(days=20), ends_at=now - timedelta(days=6))])
    current = summary(user, now)["current"]
    assert current["status"] == "expired" and current["days_left"] == 0


def test_a_live_paid_plan_beats_the_trial():
    now = datetime(2026, 11, 9)
    user = User(subscriptions=[
        Subscription(plan="trial", status=SubscriptionStatus.trialing, starts_at=now - timedelta(days=2),
                     ends_at=now + timedelta(days=12)),
        Subscription(plan="monthly", status=SubscriptionStatus.active, starts_at=now - timedelta(days=1),
                     ends_at=now + timedelta(days=29)),
    ])
    assert summary(user, now)["current"]["plan"] == "monthly"


# ---------- Settings: profile ----------

def test_profile_update_changes_only_what_was_sent(client):
    _register(client)
    resp = client.patch("/api/v1/auth/me", json={"full_name": "  Kavin  R ", "medium": "en",
                                                  "parent_email": "Parent@Example.com"})
    assert resp.status_code == 200, resp.text
    user = resp.json()
    assert user["full_name"] == "Kavin R" and user["medium"] == "en"
    assert user["parent_email"] == "parent@example.com" and user["mobile"] == "+94771234567"


def test_profile_rejects_a_bad_mobile_and_exam_year(client):
    _register(client)
    assert client.patch("/api/v1/auth/me", json={"mobile": "12345"}).status_code == 422
    assert client.patch("/api/v1/auth/me", json={"al_exam_year": 1999}).status_code == 422


def test_parent_email_can_be_cleared(client):
    _register(client)
    client.patch("/api/v1/auth/me", json={"parent_email": "p@example.com"})
    assert client.patch("/api/v1/auth/me", json={"clear_parent_email": True}).json()["parent_email"] is None


# ---------- Settings: password ----------

def test_change_password_needs_the_current_one(client):
    _register(client)
    resp = client.post("/api/v1/auth/password/change", json={"current_password": "wrong", "new_password": "n3w-password"})
    assert resp.status_code == 400 and resp.json()["detail"]["code"] == "wrong_password"


def test_change_password_keeps_this_session_and_the_new_password_logs_in(client):
    _register(client)
    resp = client.post("/api/v1/auth/password/change",
                       json={"current_password": PASSWORD, "new_password": "n3w-password"})
    assert resp.status_code == 200, resp.text
    assert client.get("/api/v1/auth/me").status_code == 200
    client.post("/api/v1/auth/logout")
    assert client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": "n3w-password"}).status_code == 200


# ---------- Settings: delete account ----------

def test_delete_needs_the_typed_email_and_password(client):
    _register(client)
    wrong_email = client.request("DELETE", "/api/v1/auth/me", json={"confirm_email": "x@example.com", "password": PASSWORD})
    assert wrong_email.json()["detail"]["code"] == "confirm_mismatch"
    wrong_pw = client.request("DELETE", "/api/v1/auth/me", json={"confirm_email": "kavin@example.com", "password": "nope"})
    assert wrong_pw.json()["detail"]["code"] == "wrong_password"
    assert _db().query(User).count() == 1


def test_delete_removes_the_student_and_their_data(client):
    user = _register(client)
    client.post("/api/v1/saved-questions", json=Q)
    db = _db()
    db.add(PracticeAnswer(user_id=user["id"], set_id=1, lang="en", slot=1, topic="Limits", steps_total=3,
                          steps_right=1, kind="practice", answered_at=datetime(2026, 11, 9)))
    db.commit()
    resp = client.request("DELETE", "/api/v1/auth/me", json={"confirm_email": "KAVIN@example.com", "password": PASSWORD})
    assert resp.status_code == 204, resp.text
    db = _db()
    for model in (User, StudentProfile, Subscription, SavedQuestion, PracticeAnswer):
        assert db.query(model).count() == 0, model.__name__
    assert client.get("/api/v1/auth/me").status_code == 401
