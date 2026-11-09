"""Admin > Subscriptions & Payments: a recorded payment starts a paid plan, renewals stack,
mistakes can be undone, and only admins can do any of it."""
from datetime import datetime

from app.core.database import get_db
from app.main import app
from app.models import Payment, Subscription
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

URL = "/api/v1/admin/billing"


def _db():
    return next(app.dependency_overrides[get_db]())


def _setup(client):
    register(client, "kavin@example.com")
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    return next(s["user_id"] for s in client.get(URL).json()["subscriptions"] if s["email"] == "kavin@example.com")


def _pay(client, user_id, plan="monthly", amount=499, **extra):
    return client.post(f"{URL}/payments", json={"user_id": user_id, "plan": plan, "amount_lkr": amount,
                                                 "method": "bank_transfer", **extra})


def _row(client, user_id):
    return next(s for s in client.get(URL).json()["subscriptions"] if s["user_id"] == user_id)


def test_students_cannot_use_it(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(URL).status_code == 403
    assert _pay(client, 1).status_code == 403
    assert client.post(f"{URL}/students/1/extend-trial", json={"days": 7}).status_code == 403


def test_new_students_are_on_trial_and_admins_are_not_listed(client):
    kavin = _setup(client)
    data = client.get(URL).json()
    assert [s["user_id"] for s in data["subscriptions"]] == [kavin]
    assert data["kpis"]["trials"] == 1 and data["kpis"]["paid"] == 0 and data["kpis"]["revenue_total"] == 0


def test_recording_a_payment_starts_a_paid_plan(client):
    kavin = _setup(client)
    assert _pay(client, kavin, reference=" SLIP-42 ").status_code == 201
    row = _row(client, kavin)
    assert row["state"] == "paid" and row["current"]["plan"] == "monthly" and row["current"]["days_left"] == 30
    data = client.get(URL).json()
    assert data["kpis"]["paid"] == 1 and data["kpis"]["revenue_30d"] == 499
    [p] = data["payments"]
    assert p["reference"] == "SLIP-42" and p["recorded_by"] == "Kavin Raj" and p["student"] == "Kavin Raj"
    # The student sees it on their own subscription page.
    login(client, "kavin@example.com")
    assert client.get("/api/v1/subscription").json()["current"]["plan"] == "monthly"


def test_paying_early_adds_on_to_the_running_plan(client):
    kavin = _setup(client)
    _pay(client, kavin)
    _pay(client, kavin)
    subs = sorted((s for s in _db().query(Subscription).filter_by(user_id=kavin) if s.plan == "monthly"),
                  key=lambda s: s.starts_at)
    assert subs[1].starts_at == subs[0].ends_at                 # no days lost


def test_removing_a_payment_also_removes_its_plan(client):
    kavin = _setup(client)
    pid = _pay(client, kavin).json()["id"]
    assert client.delete(f"{URL}/payments/{pid}").status_code == 204
    assert _row(client, kavin)["state"] == "trial"
    assert _db().query(Payment).count() == 0
    assert client.delete(f"{URL}/payments/{pid}").status_code == 204     # safe to repeat


def test_extend_trial_and_cancel(client):
    kavin = _setup(client)
    before = _row(client, kavin)["current"]["days_left"]
    after = client.post(f"{URL}/students/{kavin}/extend-trial", json={"days": 7}).json()
    assert after["current"]["days_left"] == before + 7
    sub_id = after["current"]["id"]
    res = client.post(f"{URL}/subscriptions/{sub_id}/cancel").json()
    assert res["history"][0]["status"] == "cancelled"
    assert _row(client, kavin)["state"] == "cancelled"
    # An ended trial restarts from today.
    again = client.post(f"{URL}/students/{kavin}/extend-trial", json={"days": 5}).json()
    assert again["current"]["status"] == "trialing" and again["current"]["days_left"] == 5


def test_bad_input_is_refused(client):
    kavin = _setup(client)
    assert _pay(client, kavin, amount=0).status_code == 422
    assert _pay(client, kavin, plan="weekly").status_code == 422
    assert _pay(client, 99999).status_code == 404
    admin_id = client.get("/api/v1/auth/me").json()["id"]
    assert _pay(client, admin_id).status_code == 404                    # admins don't buy plans
    assert client.post(f"{URL}/students/{kavin}/extend-trial", json={"days": 0}).status_code == 422
    assert client.post(f"{URL}/subscriptions/99999/cancel").status_code == 404


def test_paid_at_is_kept_as_given(client):
    kavin = _setup(client)
    _pay(client, kavin, paid_at="2026-11-01T10:00:00+05:30")
    assert _db().query(Payment).one().paid_at == datetime(2026, 11, 1, 4, 30)


def test_overview_counts_revenue_and_lists_payments(client):
    kavin = _setup(client)
    _pay(client, kavin, amount=4999, plan="annual")
    o = client.get("/api/v1/admin/overview?days=30").json()
    assert o["kpis"]["revenue_lkr"]["value"] == 4999
    assert len(o["revenue_per_month"]) == 6 and o["revenue_per_month"][-1]["amount_lkr"] == 4999
    assert o["latest_payments"][0]["plan"] == "annual"
