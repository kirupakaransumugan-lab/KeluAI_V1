"""Card payments through Stripe Checkout (Stripe's own hosted payment page).

1. POST /payments/checkout: we create a Checkout Session for one plan, in LKR, and send the
   student to its URL. Nothing is granted yet: coming back to /dashboard/subscription?paid=1 proves nothing.
2. Stripe calls POST /payments/stripe/webhook. We check the signature with the webhook secret,
   and only a paid session adds the payment and the plan (admin_billing.record_payment).

Each plan is a one-off payment (30 days, or until the A/L), not a recurring subscription, so
there is nothing to cancel at Stripe. The webhook is idempotent: the session id is unique on
`payments`, so a second delivery of the same event changes nothing.

Payments stay off until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both set.
"""
from __future__ import annotations

import logging
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.models.payment import Payment
from app.models.user import Role, User
from app.services.admin_billing import BillingError, plan_window, record_payment
from app.services.plans import list_plans

log = logging.getLogger(__name__)

# Plans a student can buy for themselves. "class" is paid by a teacher for many students,
# so it is still recorded by an admin.
SELF_SERVE_BILLING = ("month", "until_exam")
CURRENCY = "lkr"            # Stripe counts LKR in cents: LKR 1,500 is unit_amount 150000


class PaymentError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def enabled() -> bool:
    s = get_settings()
    return bool(s.stripe_secret_key and s.stripe_webhook_secret)


def _api_key() -> str:
    key = get_settings().stripe_secret_key
    if key is None:
        raise PaymentError("payments_disabled")
    return key.get_secret_value()


def create_checkout(db: Session, user: User, plan_key: str) -> str:
    """Start paying for `plan_key`; returns the Stripe Checkout URL to send the student to."""
    if not enabled():
        raise PaymentError("payments_disabled")
    if user.role != Role.student:
        raise PaymentError("students_only")      # the webhook could not start a plan for anyone else
    plan =next((p for p in list_plans(db, visible_only=True) if p["key"] == plan_key), None)
    if plan is None or plan["billing"] not in SELF_SERVE_BILLING:
        raise PaymentError("bad_plan")
    try:
        plan_window(user, plan_key, utcnow())    # refuse now, not after the card is charged
    except BillingError as err:
        raise PaymentError(err.code) from None

    app_url = get_settings().app_url.strip().rstrip("/")
    if not app_url.startswith(("http://", "https://")):
        log.error("APP_URL must start with http:// or https://, got %r", app_url)
        raise PaymentError("payments_misconfigured")
    try:
        session = _create_session(app_url, user, plan_key, plan)
    except stripe.StripeError as err:
        # Stripe said no (bad key, bad URL, Stripe down...): log the reason, don't show a 500.
        log.error("Stripe checkout failed for user %s: %s", user.id, err)
        raise PaymentError("stripe_error") from None
    return session.url


def _create_session(app_url: str, user: User, plan_key: str, plan: dict) -> Any:
    return stripe.checkout.Session.create(
        api_key=_api_key(),
        mode="payment",
        line_items=[{
            "quantity": 1,
            "price_data": {
                "currency": CURRENCY,
                "unit_amount": plan["price_lkr"] * 100,
                "product_data": {"name": f"KELU {plan['name_en']}"},
            },
        }],
        customer_email=user.email,
        client_reference_id=str(user.id),
        # Read back by the webhook. The price is read from the session, not from here.
        metadata={"user_id": str(user.id), "plan": plan_key},
        success_url=f"{app_url}/dashboard/subscription?paid=1",
        cancel_url=f"{app_url}/dashboard/subscription?cancelled=1",
    )


def parse_event(payload: bytes, signature: str | None) -> Any:
    """Check the Stripe-Signature header. A wrong or missing one raises PaymentError."""
    secret = get_settings().stripe_webhook_secret
    if secret is None:
        raise PaymentError("payments_disabled")
    if not signature:
        raise PaymentError("bad_signature")
    try:
        return stripe.Webhook.construct_event(payload, signature, secret.get_secret_value())
    except (ValueError, stripe.SignatureVerificationError):
        raise PaymentError("bad_signature") from None


def is_paid(session: Any) -> bool:
    """Whether a Checkout Session from a webhook event has really been paid for.

    Only "paid" counts. A slow payment method (bank debit) completes as "unpaid" and arrives
    later as checkout.session.async_payment_succeeded with "paid". "no_payment_required" (a 100%
    coupon) isn't accepted: KELU creates no coupons, so a free session here is unexpected."""
    return (session.get("payment_status") == "paid"
            and session.get("currency") == CURRENCY
            and (session.get("amount_total") or 0) > 0)


def handle_event(db: Session, event: Any) -> str:
    """Act on one verified webhook event. Returns what happened (for logs and tests)."""
    if event["type"] not in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        return "ignored"
    # stripe-python 16 objects don't support .get(); a plain dict does (nested ones too).
    session = event["data"]["object"].to_dict()
    if not is_paid(session):
        return "not_paid"
    session_id = session["id"]
    if db.scalar(select(Payment.id).where(Payment.stripe_session_id == session_id)):
        return "duplicate"

    meta = session.get("metadata") or {}
    try:
        record_payment(db, None, user_id=int(meta["user_id"]), plan=meta["plan"],
                       amount_lkr=(session.get("amount_total") or 0) // 100, method="card",
                       reference=session.get("payment_intent") or session_id,
                       stripe_session_id=session_id)
    except IntegrityError:          # the same event, delivered twice at the same moment
        db.rollback()
        return "duplicate"
    except (KeyError, ValueError, BillingError) as err:
        # Money was taken but no plan could start: an admin must sort it out (refund or record by hand).
        db.rollback()
        log.error("Stripe session %s paid but no plan started: %r", session_id, err)
        return "needs_admin"
    return "recorded"
