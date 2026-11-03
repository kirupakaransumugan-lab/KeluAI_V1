"""Everyone signs up as a student; only an admin can switch roles."""
from app.core.database import get_db
from app.main import app
from app.models.user import Role
from app.repositories import user_repository
from tests.test_auth_login import LOGIN, register


def login(client, email):
    client.cookies.clear()
    assert client.post(LOGIN, json={"email": email, "password": "s3cure-pass"}).status_code == 200


def promote_in_db(email):
    """What `python -m app.manage make-admin` does, against the test database."""
    db = next(app.dependency_overrides[get_db]())
    user = user_repository.get_by_email(db, email)
    user.role = Role.admin
    db.commit()
    return user.id


def test_new_accounts_are_students(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get("/api/v1/auth/me").json()["role"] == "student"


def test_students_cannot_use_admin_routes(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get("/api/v1/admin/users").status_code == 403
    assert client.patch("/api/v1/admin/users/1/role", json={"role": "admin"}).status_code == 403


def test_admin_promotes_a_student(client):
    register(client, "boss@example.com")
    register(client, "kavin@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")

    users = client.get("/api/v1/admin/users").json()
    kavin = next(u for u in users if u["email"] == "kavin@example.com")
    resp = client.patch(f"/api/v1/admin/users/{kavin['id']}/role", json={"role": "admin"})
    assert resp.status_code == 200 and resp.json()["role"] == "admin"

    login(client, "kavin@example.com")      # takes effect on Kavin's next request
    assert client.get("/api/v1/admin/users").status_code == 200


def test_admin_cannot_demote_self(client):
    register(client, "boss@example.com")
    boss_id = promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    resp = client.patch(f"/api/v1/admin/users/{boss_id}/role", json={"role": "student"})
    assert resp.status_code == 400


def test_unknown_role_is_rejected(client):
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    assert client.patch("/api/v1/admin/users/1/role", json={"role": "superuser"}).status_code == 422
