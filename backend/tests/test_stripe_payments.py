"""Stripe Checkout: a student starts a checkout, and only a correctly signed "paid" webhook
starts their plan, once, however many times Stripe delivers it. No real Stripe calls."""
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
from pydantic import SecretStr

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app
from app.models import Payment, Subscription
from app.services import stripe_payments
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

CHECKOUT = "/api/v1/payments/checkout"
WEBHOOK = "/api/v1/payments/stripe/webhook"
# Test-only values, never sent anywhere: Stripe is mocked out below.
TEST_KEY = "sk_test_not_a_real_key"
TEST_WHSEC = "whsec_test_only_not_a_real_secret"


@pytest.fixture
def stripe_on(monkeypatch):
    settings = get_settings().model_copy(update={
        "stripe_secret_key": SecretStr(TEST_KEY), "stripe_webhook_secret": SecretStr(TEST_WHSEC),
        "app_url": "https://kelu.test/"})
    monkeypatch.setattr(stripe_payments, "get_settings", lambda: settings)
    created = []

    def fake_create(**kwargs):
        created.append(kwargs)
        return SimpleNamespace(id=f"cs_test_{len(created)}", url=f"https://checkout.stripe.test/{len(created)}")

    monkeypatch.setattr(stripe_payments.stripe.checkout.Session, "create", fake_create)
    return created


def _db():
    return next(app.dependency_overrides[get_db]())


def _student(client, email="kavin@example.com"):
    register(client, email)
    login(client, email)
    return _db().query(Subscription).filter_by(plan="trial").first().user_id


def _signed(body: dict, secret=TEST_WHSEC) -> tuple[bytes, dict]:
    payload = json.dumps(body).encode()
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return payload, {"stripe-signature": f"t={ts},v1={sig}", "content-type": "application/json"}


def _event(user_id, plan="monthly", *, session_id="cs_test_1", paid="paid", type_="checkout.session.completed",
           amount=150000):
    return {"id": "evt_1", "object": "event", "type": type_, "data": {"object": {
        "id": session_id, "object": "checkout.session", "status": "complete", "payment_status": paid,
        "amount_total": amount, "currency": "lkr", "payment_intent": "pi_test_1",
        "metadata": {"user_id": str(user_id), "plan": plan}}}}


def _send(client, body, **kw):
    payload, headers = _signed(body, **kw)
    return client.post(WEBHOOK, content=payload, headers=headers)


# ---------- switched off ----------

def test_off_without_keys(client, monkeypatch):
    # Ignore any real keys in backend/.env: this test is about having none.
    off = get_settings().model_copy(update={"stripe_secret_key": None, "stripe_webhook_secret": None})
    monkeypatch.setattr(stripe_payments, "get_settings", lambda: off)
    _student(client)
    assert client.get("/api/v1/subscription").json()["payments_enabled"] is False
    assert client.post(CHECKOUT, json={"plan": "monthly"}).status_code == 503
    assert client.post(WEBHOOK, content=b"{}", headers={"stripe-signature": "t=1,v1=x"}).status_code == 503


# ---------- checkout ----------

def test_checkout_sends_the_student_to_stripe_in_lkr(client, stripe_on):
    uid = _student(client)
    assert client.get("/api/v1/subscription").json()["payments_enabled"] is True
    resp = client.post(CHECKOUT, json={"plan": "monthly"})
    assert resp.status_code == 200 and resp.json()["url"] == "https://checkout.stripe.test/1"
    [args] = stripe_on
    item = args["line_items"][0]["price_data"]
    assert item["currency"] == "lkr" and item["unit_amount"] == 1500 * 100
    assert args["metadata"] == {"user_id": str(uid), "plan": "monthly"} and args["api_key"] == TEST_KEY
    assert args["success_url"] == "https://kelu.test/dashboard/subscription?paid=1"
    assert _db().query(Payment).count() == 0          # nothing granted until the webhook


@pytest.mark.parametrize("plan", ["free", "class", "trial", "nope"])
def test_checkout_refuses_plans_students_cannot_buy(client, stripe_on, plan):
    _student(client)
    assert client.post(CHECKOUT, json={"plan": plan}).status_code == 422
    assert stripe_on == []


def test_checkout_needs_a_student(client, stripe_on):
    assert client.post(CHECKOUT, json={"plan": "monthly"}).status_code == 401
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    assert client.post(CHECKOUT, json={"plan": "monthly"}).json()["detail"] == "students_only"


# ---------- webhook ----------

def test_paid_webhook_starts_the_plan_once(client, stripe_on):
    uid = _student(client)
    assert _send(client, _event(uid)).json() == {"result": "recorded"}
    assert _send(client, _event(uid)).json() == {"result": "duplicate"}      # Stripe retries
    [p] = _db().query(Payment).all()
    assert (p.method, p.amount_lkr, p.stripe_session_id, p.recorded_by_id) == ("card", 1500, "cs_test_1", None)
    current = client.get("/api/v1/subscription").json()["current"]
    assert current["plan"] == "monthly" and current["status"] == "active" and current["days_left"] == 30


def test_bad_signature_is_refused(client, stripe_on):
    uid = _student(client)
    assert _send(client, _event(uid), secret="whsec_someone_else").status_code == 400
    payload, _ = _signed(_event(uid))
    assert client.post(WEBHOOK, content=payload).status_code == 400            # no header at all
    assert _db().query(Payment).count() == 0


def test_unpaid_and_other_events_change_nothing(client, stripe_on):
    uid = _student(client)
    assert _send(client, _event(uid, paid="unpaid")).json() == {"result": "not_paid"}
    assert _send(client, _event(uid, type_="customer.created")).json() == {"result": "ignored"}
    assert _db().query(Payment).count() == 0
    # A bank debit that clears later arrives as async_payment_succeeded.
    late = _event(uid, type_="checkout.session.async_payment_succeeded")
    assert _send(client, late).json() == {"result": "recorded"}


def test_paid_but_impossible_plan_is_left_for_an_admin(client, stripe_on):
    uid = _student(client)
    assert _send(client, _event(uid, plan="free")).json() == {"result": "needs_admin"}
    assert _db().query(Payment).count() == 0


def test_stripe_refusing_the_checkout_is_a_502_not_a_crash(client, stripe_on, monkeypatch):
    _student(client)

    def refuse(**kwargs):
        raise stripe_payments.stripe.InvalidRequestError("Not a valid URL", "success_url")

    monkeypatch.setattr(stripe_payments.stripe.checkout.Session, "create", refuse)
    resp = client.post(CHECKOUT, json={"plan": "monthly"})
    assert resp.status_code == 502 and resp.json()["detail"] == "stripe_error"
