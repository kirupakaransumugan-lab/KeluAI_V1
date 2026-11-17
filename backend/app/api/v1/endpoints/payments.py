"""Card payments through Stripe Checkout (app/services/stripe_payments.py)."""
from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services import stripe_payments

router = APIRouter(prefix="/payments", tags=["payments"])


class CheckoutRequest(BaseModel):
    plan: str = Field(max_length=20)


def _fail(err: stripe_payments.PaymentError) -> NoReturn:
    code = {"payments_disabled": status.HTTP_503_SERVICE_UNAVAILABLE,
            "payments_misconfigured": status.HTTP_503_SERVICE_UNAVAILABLE,
            "stripe_error": status.HTTP_502_BAD_GATEWAY,
            "bad_signature": status.HTTP_400_BAD_REQUEST}.get(err.code, status.HTTP_422_UNPROCESSABLE_CONTENT)
    raise HTTPException(code, detail=err.code)


@router.post("/checkout")
def checkout(data: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    try:
        return {"url": stripe_payments.create_checkout(db, user, data.plan)}
    except stripe_payments.PaymentError as err:
        _fail(err)


@router.post("/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    # No login here: Stripe calls it. The signature check is what proves the call is real,
    # and it needs the body exactly as sent, so it is read raw rather than as JSON.
    payload = await request.body()
    try:
        event = stripe_payments.parse_event(payload, request.headers.get("stripe-signature"))
    except stripe_payments.PaymentError as err:
        _fail(err)
    return {"result": stripe_payments.handle_event(db, event)}
