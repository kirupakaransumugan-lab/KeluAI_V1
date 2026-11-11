import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.api.v1.endpoints import auth as auth_endpoints
from app.core import microsoft_auth
from app.core.config import get_settings
from app.core.microsoft_auth import (
    CONSUMER_TENANT, MicrosoftEmailUnverified, MicrosoftTokenError, verify_microsoft_id_token,
)
from app.core.social_identity import SocialIdentity
from app.schemas.auth import allowed_exam_years

URL = "/api/v1/auth/microsoft"
IDENTITY = SocialIdentity(sub="ms-abc", email="nila@outlook.com", full_name="Nila Kumar")
PROFILE = {"mobile": "0771234567", "medium": "en", "al_exam_year": allowed_exam_years()[0], "accept_terms": True}
WORK_TENANT = "11111111-2222-3333-4444-555555555555"


@pytest.fixture
def microsoft_on(monkeypatch):
    """Enable Microsoft sign-in and replace the token check with a fake."""
    monkeypatch.setattr(get_settings(), "microsoft_client_id", "ms-client-id")

    def fake_verify(credential, client_id):
        assert client_id == "ms-client-id"
        if credential == "unverified-token":
            raise MicrosoftEmailUnverified("no verified email")
        if credential != "good-token":
            raise MicrosoftTokenError("bad")
        return IDENTITY

    monkeypatch.setattr(auth_endpoints, "verify_microsoft_id_token", fake_verify)


# ---- endpoint ------------------------------------------------------------------------------

def test_providers_reports_microsoft_client_id(client, microsoft_on):
    assert client.get("/api/v1/auth/providers").json()["microsoft_client_id"] == "ms-client-id"


def test_microsoft_disabled_without_client_id(client):
    assert client.post(URL, json={"credential": "good-token"}).status_code == 503


def test_invalid_and_unverified_tokens_are_rejected(client, microsoft_on):
    bad = client.post(URL, json={"credential": "forged"})
    assert bad.status_code == 401 and bad.json()["detail"]["code"] == "microsoft_invalid"
    unverified = client.post(URL, json={"credential": "unverified-token"})
    assert unverified.status_code == 403 and unverified.json()["detail"]["code"] == "microsoft_email_unverified"


def test_first_microsoft_sign_in_asks_for_profile_then_creates_student(client, microsoft_on):
    first = client.post(URL, json={"credential": "good-token"})
    assert first.status_code == 428
    assert first.json()["detail"] == {"code": "profile_required", "full_name": "Nila Kumar", "email": "nila@outlook.com"}

    resp = client.post(URL, json={"credential": "good-token", "profile": PROFILE})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["email"] == "nila@outlook.com"

    client.cookies.clear()
    assert client.post(URL, json={"credential": "good-token"}).status_code == 200   # no profile second time


def test_microsoft_links_existing_email_account(client, microsoft_on):
    client.post("/api/v1/auth/register",
                json={"full_name": "Nila Kumar", "email": "nila@outlook.com", "password": "s3cure-pass", **PROFILE})
    client.cookies.clear()
    assert client.post(URL, json={"credential": "good-token"}).status_code == 200
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", json={"email": "nila@outlook.com", "password": "s3cure-pass"})
    assert login.status_code == 200


# ---- token verification (real signatures with a test key) ---------------------------------

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": _KEY.public_key()})()


@pytest.fixture
def test_keys(monkeypatch):
    monkeypatch.setattr(microsoft_auth, "_jwks", lambda: _FakeJwks())


def _token(tid: str, **claims) -> str:
    now = int(time.time())
    body = {"aud": "ms-client-id", "iss": f"https://login.microsoftonline.com/{tid}/v2.0", "tid": tid,
            "sub": "ms-abc", "name": "Nila Kumar", "iat": now, "exp": now + 3600, **claims}
    return jwt.encode(body, _KEY, algorithm="RS256")


def test_personal_account_is_accepted(test_keys):
    ident = verify_microsoft_id_token(_token(CONSUMER_TENANT, email="Nila@Outlook.com"), "ms-client-id")
    assert ident == SocialIdentity(sub="ms-abc", email="nila@outlook.com", full_name="Nila Kumar")


def test_personal_account_without_email_claim_uses_preferred_username(test_keys):
    ident = verify_microsoft_id_token(_token(CONSUMER_TENANT, preferred_username="nila@hotmail.com"), "ms-client-id")
    assert ident.email == "nila@hotmail.com"


def test_work_account_email_needs_microsofts_verified_domain_claim(test_keys):
    # nOAuth: a tenant admin can write any address into "email"; it must not link accounts.
    with pytest.raises(MicrosoftEmailUnverified):
        verify_microsoft_id_token(_token(WORK_TENANT, email="victim@gmail.com"), "ms-client-id")
    ok = verify_microsoft_id_token(_token(WORK_TENANT, email="t@school.lk", xms_edov=True), "ms-client-id")
    assert ok.email == "t@school.lk"


def test_wrong_audience_or_issuer_is_rejected(test_keys):
    with pytest.raises(MicrosoftTokenError):
        verify_microsoft_id_token(_token(CONSUMER_TENANT, email="a@outlook.com"), "another-app")
    forged_iss = _token(CONSUMER_TENANT, email="a@outlook.com", iss="https://evil.example/v2.0")
    with pytest.raises(MicrosoftTokenError):
        verify_microsoft_id_token(forged_iss, "ms-client-id")
