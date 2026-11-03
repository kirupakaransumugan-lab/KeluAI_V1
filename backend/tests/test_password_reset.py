import re
import time

import jwt
import pytest

from app.core.config import get_settings
from app.schemas.auth import allowed_exam_years
from app.services import email_service

FORGOT = "/api/v1/auth/password/forgot"
VERIFY = "/api/v1/auth/password/verify"
RESET = "/api/v1/auth/password/reset"
EMAIL = "kavin@example.com"


@pytest.fixture
def outbox(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr(email_service, "send_email", lambda to, subject, body: sent.append({"to": to, "body": body}))
    return sent


@pytest.fixture
def student(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Kavin Raj",
            "email": EMAIL,
            "mobile": "0771234567",
            "password": "old-password",
            "medium": "en",
            "al_exam_year": allowed_exam_years()[0],
            "accept_terms": True,
        },
    )
    assert resp.status_code == 201
    return resp


def emailed_code(outbox) -> str:
    return re.search(r"\b(\d{6})\b", outbox[-1]["body"]).group(1)


def test_full_reset_flow(client, student, outbox):
    old_cookie = client.cookies.get("kelu_access")

    assert client.post(FORGOT, json={"email": "KAVIN@example.com"}).status_code == 202
    assert outbox[-1]["to"] == EMAIL
    code = emailed_code(outbox)

    verify = client.post(VERIFY, json={"email": EMAIL, "code": code})
    assert verify.status_code == 200, verify.text
    token = verify.json()["reset_token"]

    reset = client.post(RESET, json={"reset_token": token, "new_password": "brand-new-pass"})
    assert reset.status_code == 200, reset.text
    assert reset.json()["user"]["email"] == EMAIL

    client.cookies.clear()
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "old-password"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "brand-new-pass"}).status_code == 200

    # The reset token is single use.
    again = client.post(RESET, json={"reset_token": token, "new_password": "another-pass-1"})
    assert again.status_code == 400

    # Sessions from before the reset are signed out (token backdated an hour to be clear of "same second").
    old = jwt.decode(old_cookie, options={"verify_signature": False})
    settings = get_settings()
    stale = jwt.encode({**old, "iat": int(time.time()) - 3600}, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    client.cookies.clear()
    client.cookies.set("kelu_access", stale, path="/api")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_unknown_email_gets_same_answer_and_no_email(client, outbox):
    resp = client.post(FORGOT, json={"email": "nobody@example.com"})
    assert resp.status_code == 202
    assert resp.json() == {"status": "sent_if_exists"}
    assert outbox == []


def test_wrong_code_is_rejected_and_attempts_are_limited(client, student, outbox):
    client.post(FORGOT, json={"email": EMAIL})
    code = emailed_code(outbox)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        resp = client.post(VERIFY, json={"email": EMAIL, "code": wrong})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "invalid_code"
    # Out of attempts: even the right code no longer works.
    assert client.post(VERIFY, json={"email": EMAIL, "code": code}).status_code == 400


def test_new_code_replaces_old_one(client, student, outbox, monkeypatch):
    from app.services import password_reset_service

    monkeypatch.setattr(password_reset_service, "can_send_new_code", lambda last, now: True)
    client.post(FORGOT, json={"email": EMAIL})
    first = emailed_code(outbox)
    client.post(FORGOT, json={"email": EMAIL})
    second = emailed_code(outbox)
    if first != second:
        assert client.post(VERIFY, json={"email": EMAIL, "code": first}).status_code == 400
    assert client.post(VERIFY, json={"email": EMAIL, "code": second}).status_code == 200


def test_reset_token_cannot_be_used_as_session(client, student, outbox):
    client.post(FORGOT, json={"email": EMAIL})
    token = client.post(VERIFY, json={"email": EMAIL, "code": emailed_code(outbox)}).json()["reset_token"]
    client.cookies.clear()
    client.cookies.set("kelu_access", token, path="/api")
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"reset_token": "garbage", "new_password": "long-enough-pass"},
    ],
)
def test_bad_reset_token(client, body):
    assert client.post(RESET, json=body).status_code == 400


def test_short_new_password_is_rejected(client):
    assert client.post(RESET, json={"reset_token": "x", "new_password": "short"}).status_code == 422
