"""Admin > Students: admin only, the same figures the student sees, and switching accounts off."""
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import LOGIN, register

URL = "/api/v1/admin/students"


def _ids(client):
    return {s["email"]: s["id"] for s in client.get(URL).json()["students"]}


def _setup(client):
    """kavin practised one set; nila did nothing; boss is the admin (logged in)."""
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    client.post("/api/v1/progress/attempts", json={"set_id": 1, "lang": "en", "answers": [
        {"slot": 1, "topic": "Limits", "steps_total": 4, "steps_right": 4},
        {"slot": 2, "topic": "Limits", "steps_total": 4, "steps_right": 2}]})
    register(client, "nila@example.com")
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    return _ids(client)


def test_students_cannot_use_it(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(URL).status_code == 403
    assert client.get(f"{URL}/1").status_code == 403
    assert client.patch(f"{URL}/1/status", json={"active": False}).status_code == 403


def test_list_has_students_only_with_their_practice(client):
    ids = _setup(client)
    assert set(ids) == {"kavin@example.com", "nila@example.com"}          # no admin
    rows = {s["email"]: s for s in client.get(URL).json()["students"]}
    assert rows["kavin@example.com"]["questions"] == 2 and rows["kavin@example.com"]["last_active_at"]
    assert rows["nila@example.com"]["questions"] == 0 and rows["nila@example.com"]["plan_state"] == "trial"
    assert [s["email"] for s in client.get(f"{URL}?q=nila").json()["students"]] == ["nila@example.com"]
    assert client.get(f"{URL}?medium=ta").json()["students"] == []


def test_detail_matches_the_students_own_report(client):
    ids = _setup(client)
    d = client.get(f"{URL}/{ids['kavin@example.com']}").json()
    assert d["student"]["full_name"] == "Kavin Raj" and d["student"]["is_active"] is True
    assert d["progress"]["accuracy"] == {"value": 50, "questions": 2}       # one of two fully right
    assert d["progress"]["topics_covered"]["covered"] == 1
    assert len(d["activity"]) == 3 and all(len(w["days"]) == 7 for w in d["activity"])
    assert sum(day["questions"] for w in d["activity"] for day in w["days"]) == 2
    assert d["sessions"][0]["questions"] == 2
    assert d["subscription"]["current"]["plan"] == "trial"


def test_admins_and_unknown_ids_are_not_found(client):
    _setup(client)
    admin_id = client.get("/api/v1/auth/me").json()["id"]
    assert client.get(f"{URL}/{admin_id}").status_code == 404
    assert client.patch(f"{URL}/{admin_id}/status", json={"active": False}).status_code == 404
    assert client.get(f"{URL}/99999").status_code == 404


def test_a_switched_off_student_is_signed_out_and_cannot_log_in(client):
    ids = _setup(client)
    kavin = ids["kavin@example.com"]
    # kavin has a session open in another browser.
    other = client.__class__(client.app)
    assert other.post(LOGIN, json={"email": "kavin@example.com", "password": "s3cure-pass"}).status_code == 200

    assert client.patch(f"{URL}/{kavin}/status", json={"active": False}).json()["is_active"] is False
    resp = other.get("/api/v1/auth/me")
    assert resp.status_code == 401 and resp.json()["detail"]["code"] == "account_disabled"
    resp = other.post(LOGIN, json={"email": "kavin@example.com", "password": "s3cure-pass"})
    assert resp.status_code == 403 and resp.json()["detail"]["code"] == "account_disabled"
    # A wrong password still gets the usual answer, so this can't be used to test emails.
    assert other.post(LOGIN, json={"email": "kavin@example.com", "password": "nope-nope"}).status_code == 401

    client.patch(f"{URL}/{kavin}/status", json={"active": True})
    assert other.post(LOGIN, json={"email": "kavin@example.com", "password": "s3cure-pass"}).status_code == 200
