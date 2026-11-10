"""Admin > Plans: the price list comes from code defaults until an admin edits it, edits reach
students and the payment form, and only admins can change it."""
from datetime import datetime

from tests.test_admin_billing import URL as BILLING, _pay, _setup
from tests.test_admin_roles import login
from tests.test_auth_login import register

URL = "/api/v1/admin/plans"


def _plan(client, key):
    return next(p for p in client.get(URL).json()["plans"] if p["key"] == key)


def test_students_cannot_see_or_edit_plans(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(URL).status_code == 403
    assert client.patch(f"{URL}/monthly", json={"price_lkr": 1}).status_code == 403


def test_defaults_are_the_published_price_list(client):
    _setup(client)
    plans = client.get(URL).json()["plans"]
    assert [(p["key"], p["price_lkr"]) for p in plans] == [
        ("free", 0), ("monthly", 1500), ("until_exam", 12000), ("class", 1000)]
    assert [p["key"] for p in plans if p["highlight"]] == ["until_exam"]
    assert _plan(client, "free")["students"] == 1          # the new student has no paid plan


def test_a_price_change_reaches_students_and_the_payment_form(client):
    _setup(client)
    r = client.patch(f"{URL}/monthly", json={"price_lkr": 1750, "name_en": "  Monthly+ "})
    assert r.status_code == 200 and r.json()["name_en"] == "Monthly+"
    assert next(p for p in client.get(BILLING).json()["plans"] if p["key"] == "monthly")["price_lkr"] == 1750
    login(client, "kavin@example.com")
    assert next(p for p in client.get("/api/v1/subscription").json()["plans"]
                if p["key"] == "monthly")["price_lkr"] == 1750


def test_hidden_plans_leave_the_student_list_but_can_still_be_sold(client):
    kavin = _setup(client)
    client.patch(f"{URL}/class", json={"is_visible": False})
    assert "class" in [p["key"] for p in client.get(BILLING).json()["plans"]]
    assert _pay(client, kavin, plan="class", amount=1000).status_code == 201
    login(client, "kavin@example.com")
    assert "class" not in [p["key"] for p in client.get("/api/v1/subscription").json()["plans"]]


def test_only_one_plan_is_highlighted(client):
    _setup(client)
    client.patch(f"{URL}/monthly", json={"highlight": True})
    assert [p["key"] for p in client.get(URL).json()["plans"] if p["highlight"]] == ["monthly"]


def test_free_stays_free_and_names_are_required(client):
    _setup(client)
    assert client.patch(f"{URL}/free", json={"price_lkr": 100}).json()["detail"]["code"] == "free_has_no_price"
    assert client.patch(f"{URL}/monthly", json={"name_en": "  "}).status_code == 422
    assert client.patch(f"{URL}/annual", json={"price_lkr": 1}).status_code == 422     # not a plan key


def test_plan_stats_count_students_and_revenue(client):
    kavin = _setup(client)
    _pay(client, kavin, plan="class", amount=1000)
    cls, free = _plan(client, "class"), _plan(client, "free")
    assert cls["students"] == 1 and cls["revenue_total"] == 1000 and cls["revenue_30d"] == 1000 and cls["payments"] == 1
    assert free["students"] == 0


def test_until_exam_runs_to_the_students_exam_year(client):
    kavin = _setup(client)
    assert _pay(client, kavin, plan="until_exam", amount=12000).status_code == 201
    login(client, "kavin@example.com")
    sub = client.get("/api/v1/subscription").json()["current"]
    exam_year = client.get("/api/v1/auth/me").json()["al_exam_year"]
    assert sub["plan"] == "until_exam"
    assert datetime.fromisoformat(sub["ends_at"].rstrip("Z")).year == exam_year


def test_the_public_price_list_needs_no_login_and_hides_admin_numbers(client):
    _setup(client)
    client.patch(f"{URL}/class", json={"is_visible": False})
    client.patch(f"{URL}/monthly", json={"price_lkr": 1600})
    client.cookies.clear()
    plans = client.get("/api/v1/plans").json()["plans"]
    assert [p["key"] for p in plans] == ["free", "monthly", "until_exam"]
    assert plans[1]["price_lkr"] == 1600
    assert "students" not in plans[0] and "is_visible" not in plans[0] and "revenue_total" not in plans[0]
