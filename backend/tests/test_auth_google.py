import pytest

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import get_settings
from app.core.google_auth import GoogleIdentity, GoogleTokenError
from app.schemas.auth import allowed_exam_years

URL = "/api/v1/auth/google"
IDENTITY = GoogleIdentity(sub="google-123", email="kavin@example.com", full_name="Kavin Raj")
PROFILE = {"mobile": "0771234567", "medium": "ta", "al_exam_year": allowed_exam_years()[0], "accept_terms": True}


@pytest.fixture
def google_on(monkeypatch):
    """Enable Google sign-in and replace Google's signature check with a fake."""
    monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")

    def fake_verify(credential, client_id):
        assert client_id == "test-client-id"
        if credential != "good-token":
            raise GoogleTokenError("bad")
        return IDENTITY

    monkeypatch.setattr(auth_endpoints, "verify_google_id_token", fake_verify)


def test_providers_reports_google_client_id(client, google_on):
    assert client.get("/api/v1/auth/providers").json() == {"google_client_id": "test-client-id", "microsoft_client_id": None}


def test_google_disabled_without_client_id(client):
    resp = client.post(URL, json={"credential": "good-token"})
    assert resp.status_code == 503


def test_invalid_google_token_is_rejected(client, google_on):
    resp = client.post(URL, json={"credential": "forged"})
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "google_invalid"


def test_first_google_sign_in_asks_for_profile_then_creates_student(client, google_on):
    first = client.post(URL, json={"credential": "good-token"})
    assert first.status_code == 428
    assert first.json()["detail"] == {"code": "profile_required", "full_name": "Kavin Raj", "email": "kavin@example.com"}
    assert "set-cookie" not in first.headers

    resp = client.post(URL, json={"credential": "good-token", "profile": PROFILE})
    assert resp.status_code == 200, resp.text
    user = resp.json()["user"]
    assert user["email"] == "kavin@example.com" and user["medium"] == "ta" and user["trial_ends_at"]
    assert client.get("/api/v1/auth/me").status_code == 200

    # Second time round: straight in, no profile needed.
    client.cookies.clear()
    assert client.post(URL, json={"credential": "good-token"}).status_code == 200


def test_google_links_existing_email_account(client, google_on):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Kavin Raj", "email": "kavin@example.com", "password": "s3cure-pass", **PROFILE},
    )
    client.cookies.clear()
    resp = client.post(URL, json={"credential": "good-token"})
    assert resp.status_code == 200
    # Password login still works after linking.
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": "s3cure-pass"})
    assert login.status_code == 200


def test_google_only_account_cannot_password_login(client, google_on):
    client.post(URL, json={"credential": "good-token", "profile": PROFILE})
    client.cookies.clear()
    resp = client.post("/api/v1/auth/login", json={"email": "kavin@example.com", "password": "anything-at-all"})
    assert resp.status_code == 401


def test_invalid_profile_is_rejected(client, google_on):
    resp = client.post(URL, json={"credential": "good-token", "profile": {**PROFILE, "mobile": "123"}})
    assert resp.status_code == 422
