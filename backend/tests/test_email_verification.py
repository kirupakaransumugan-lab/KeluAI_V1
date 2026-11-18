"""Sign-up email verification: a made-up email can't use KELU, a real inbox gets in with the code."""
import re
from datetime import timedelta

import pytest

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import get_settings
from app.core.database import get_db
from app.core.google_auth import GoogleIdentity
from app.main import app
from app.models.email_verification import EmailVerificationCode
from app.schemas.auth import allowed_exam_years
from tests.test_auth_login import register

SIGNUP = {"full_name": "Kavin Raj", "email": "kavin@example.com", "mobile": "0771234567",
          "password": "s3cure-pass", "medium": "en", "al_exam_year": allowed_exam_years()[0], "accept_terms": True}
VERIFY = "/api/v1/auth/email/verify"
RESEND = "/api/v1/auth/email/resend"


def _signup(client, **changes):
    resp = client.post("/api/v1/auth/register", json=SIGNUP | changes)
    assert resp.status_code == 201, resp.text
    return resp.json()["user"]


def _code(outbox) -> str:
    return re.search(r"\b(\d{6})\b", outbox[-1]["body"]).group(1)


def _wrong(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


def _rewind_codes(minutes: int):
    """Make the sent codes look older, instead of waiting in real time."""
    db = next(app.dependency_overrides[get_db]())
    for row in db.query(EmailVerificationCode):
        row.created_at -= timedelta(minutes=minutes)
    db.commit()


def test_sign_up_sends_a_code_and_locks_the_app_until_it_is_entered(client, outbox):
    user = _signup(client)
    assert user["email_verified"] is False
    assert [m["to"] for m in outbox] == ["kavin@example.com"] and "verification code" in outbox[0]["subject"]

    # Signed in, but everything except the verify screen is closed.
    assert client.get("/api/v1/subscription").json()["detail"]["code"] == "email_unverified"
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["email_verified"] is False
    assert client.get("/api/v1/auth/session").json()["user"]["email"] == "kavin@example.com"

    resp = client.post(VERIFY, json={"code": _code(outbox)})
    assert resp.status_code == 200 and resp.json()["user"]["email_verified"] is True
    assert client.get("/api/v1/subscription").status_code == 200


def test_the_email_is_in_the_students_medium(client, outbox):
    _signup(client, medium="ta")
    assert "சரிபார்ப்புக் குறியீடு" in outbox[0]["subject"]


def test_wrong_codes_are_refused_and_five_retire_the_code(client, outbox):
    _signup(client)
    code = _code(outbox)
    for _ in range(get_settings().verify_code_max_attempts):
        assert client.post(VERIFY, json={"code": _wrong(code)}).json()["detail"]["code"] == "invalid_code"
    # Even the right code no longer works: guessing a million codes five at a time isn't possible.
    assert client.post(VERIFY, json={"code": code}).status_code == 400
    assert client.post(VERIFY, json={"code": "12ab56"}).status_code == 422


def test_an_expired_code_is_refused(client, outbox):
    _signup(client)
    _rewind_codes(0)
    db = next(app.dependency_overrides[get_db]())
    for row in db.query(EmailVerificationCode):
        row.expires_at -= timedelta(minutes=get_settings().verify_code_minutes + 1)
    db.commit()
    assert client.post(VERIFY, json={"code": _code(outbox)}).status_code == 400


def test_resend_waits_a_minute_and_only_the_newest_code_works(client, outbox):
    _signup(client)
    first = _code(outbox)
    too_soon = client.post(RESEND)
    assert too_soon.status_code == 429 and 0 < too_soon.json()["detail"]["retry_after"] <= 60

    _rewind_codes(2)
    assert client.post(RESEND).status_code == 202
    second = _code(outbox)
    assert len(outbox) == 2
    if first != second:
        assert client.post(VERIFY, json={"code": first}).status_code == 400
    assert client.post(VERIFY, json={"code": second}).status_code == 200
    assert client.post(RESEND).json()["status"] == "already_verified"


def test_at_most_five_codes_an_hour(client, outbox):
    _signup(client)
    for _ in range(get_settings().verify_max_per_hour - 1):
        _rewind_codes(2)
        assert client.post(RESEND).status_code == 202
    _rewind_codes(2)
    assert client.post(RESEND).status_code == 429
    assert len(outbox) == get_settings().verify_max_per_hour


def test_logging_in_before_verifying_sends_a_fresh_code(client, outbox):
    _signup(client)
    client.cookies.clear()
    _rewind_codes(5)
    login = client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": "s3cure-pass"})
    assert login.status_code == 200 and login.json()["user"]["email_verified"] is False
    assert len(outbox) == 2
    assert client.post(VERIFY, json={"code": _code(outbox)}).status_code == 200


def test_existing_and_verified_students_are_not_bothered(client, outbox):
    register(client)                 # the shared helper verifies, like a student who entered the code
    client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": "s3cure-pass"})
    assert client.get("/api/v1/auth/me").json()["email_verified"] is True
    assert len(outbox) == 1          # only the sign-up code, nothing on later log-ins


def test_a_password_reset_also_proves_the_email(client, outbox):
    _signup(client)
    client.cookies.clear()
    client.post("/api/v1/auth/password/forgot", json={"email": "kavin@example.com"})
    token = client.post("/api/v1/auth/password/verify",
                        json={"email": "kavin@example.com", "code": _code(outbox)}).json()["reset_token"]
    user = client.post("/api/v1/auth/password/reset", json={"reset_token": token, "new_password": "n3w-secure-pass"})
    assert user.json()["user"]["email_verified"] is True


@pytest.fixture
def google_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
    monkeypatch.setattr(auth_endpoints, "verify_google_id_token",
                        lambda credential, client_id: GoogleIdentity(sub="g-1", email="kavin@example.com",
                                                                     full_name="Kavin Raj"))


def test_google_sign_ups_count_as_verified(client, outbox, google_on):
    profile = {k: SIGNUP[k] for k in ("mobile", "medium", "al_exam_year", "accept_terms")}
    user = client.post("/api/v1/auth/google", json={"credential": "t", "profile": profile}).json()["user"]
    assert user["email_verified"] is True and outbox == []


def test_someone_who_squatted_an_email_loses_access_when_the_owner_signs_in_with_google(
        client, outbox, google_on, monkeypatch):
    # An attacker signs up with the victim's email and a password they know, and never verifies.
    _signup(client)
    attacker = dict(client.cookies)
    client.cookies.clear()
    # The owner arrives later (sessions are compared to the second, and this test runs in one).
    from app.core.clock import utcnow
    from app.services import auth_service

    later = utcnow() + timedelta(minutes=5)
    monkeypatch.setattr(auth_service, "utcnow", lambda: later)
    # The real owner signs in with Google: Google proves the inbox is theirs.
    owner = client.post("/api/v1/auth/google", json={"credential": "t"})
    assert owner.status_code == 200 and owner.json()["user"]["email_verified"] is True
    assert owner.json()["user"]["has_password"] is False
    # The attacker's password and session no longer get in.
    client.cookies.clear()
    assert client.post("/api/v1/auth/login",
                       json={"email": "kavin@example.com", "password": "s3cure-pass"}).status_code == 401
    client.cookies.clear()
    client.cookies.update(attacker)
    assert client.get("/api/v1/auth/me").status_code == 401
