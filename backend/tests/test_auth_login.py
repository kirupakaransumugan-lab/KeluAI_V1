from app.schemas.auth import allowed_exam_years

LOGIN = "/api/v1/auth/login"


def register(client, email="kavin@example.com", password="s3cure-pass"):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Kavin Raj",
            "email": email,
            "mobile": "0771234567",
            "password": password,
            "medium": "en",
            "al_exam_year": allowed_exam_years()[0],
            "accept_terms": True,
        },
    )
    assert resp.status_code == 201
    client.cookies.clear()  # start logged out, like a fresh browser


def test_login_sets_cookie_and_returns_user(client):
    register(client)
    resp = client.post(LOGIN, json={"email": "KAVIN@example.com", "password": "s3cure-pass"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["email"] == "kavin@example.com"
    assert "httponly" in resp.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_answer(client):
    register(client)
    wrong = client.post(LOGIN, json={"email": "kavin@example.com", "password": "nope-nope"})
    unknown = client.post(LOGIN, json={"email": "nobody@example.com", "password": "s3cure-pass"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": {"code": "invalid_credentials"}}
    assert "set-cookie" not in wrong.headers


def test_overlong_password_is_rejected_not_truncated(client):
    register(client, password="a" * 72)
    resp = client.post(LOGIN, json={"email": "kavin@example.com", "password": "a" * 73})
    assert resp.status_code == 401


def test_logout_clears_session(client):
    register(client)
    client.post(LOGIN, json={"email": "kavin@example.com", "password": "s3cure-pass"})
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
