from datetime import datetime, timezone

import pytest

from app.schemas.auth import allowed_exam_years, normalize_sl_mobile

URL = "/api/v1/auth/register"


def payload(**overrides):
    data = {
        "full_name": "  Kavin   Raj ",
        "email": "Kavin@Example.com",
        "mobile": "077 123 4567",
        "password": "s3cure-pass",
        "medium": "ta",
        "al_exam_year": allowed_exam_years()[1],
        "accept_terms": True,
    }
    data.update(overrides)
    return data


def error_fields(resp):
    return {e["loc"][-1] for e in resp.json()["detail"]}


def test_register_creates_student_with_trial_and_sets_cookie(client):
    resp = client.post(URL, json=payload())
    assert resp.status_code == 201, resp.text
    user = resp.json()["user"]
    assert user["full_name"] == "Kavin Raj"
    assert user["email"] == "kavin@example.com"
    assert user["role"] == "student"
    assert user["medium"] == "ta"
    trial_days = (datetime.fromisoformat(user["trial_ends_at"]) - datetime.now(timezone.utc).replace(tzinfo=None)).days
    assert trial_days in (13, 14)
    assert "password" not in resp.text and "password_hash" not in resp.text

    set_cookie = resp.headers["set-cookie"].lower()
    assert "kelu_access=" in set_cookie and "httponly" in set_cookie and "samesite=lax" in set_cookie

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "kavin@example.com"


def test_duplicate_email_is_rejected_case_insensitively(client):
    assert client.post(URL, json=payload()).status_code == 201
    resp = client.post(URL, json=payload(email="KAVIN@example.com"))
    assert resp.status_code == 409
    assert resp.json()["detail"] == {"code": "email_taken", "field": "email"}


@pytest.mark.parametrize(
    "field, value",
    [
        ("mobile", "0112345678"),          # landline, not mobile
        ("mobile", "07712345"),            # too short
        ("password", "short"),
        ("password", "த" * 25),            # 75 bytes > bcrypt's 72
        ("medium", "si"),
        ("al_exam_year", 2001),
        ("accept_terms", False),
        ("email", "not-an-email"),
        ("full_name", " a "),
    ],
)
def test_invalid_input_is_rejected(client, field, value):
    resp = client.post(URL, json=payload(**{field: value}))
    assert resp.status_code == 422
    assert field in error_fields(resp)


def test_me_without_cookie_is_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("0771234567", "+94771234567"),
        ("077 123 4567", "+94771234567"),
        ("+94 77 123 4567", "+94771234567"),
        ("94-77-123-4567", "+94771234567"),
    ],
)
def test_normalize_sl_mobile(raw, expected):
    assert normalize_sl_mobile(raw) == expected
