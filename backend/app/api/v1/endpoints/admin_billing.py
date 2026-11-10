"""Admin > Subscriptions & Payments (app/services/admin_billing.py)."""
from datetime import datetime, timezone
from typing import Literal, NoReturn

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import get_current_admin
from app.core.database import get_db
from app.models.user import User
from app.services import admin_billing

router = APIRouter(prefix="/admin/billing", tags=["admin"])


class NewPayment(BaseModel):
    user_id: int
    plan: Literal["monthly", "until_exam", "class"]
    amount_lkr: int = Field(gt=0, le=1_000_000)
    method: Literal["bank_transfer", "cash", "card", "other"]
    reference: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=255)
    paid_at: datetime | None = None          # default: now


class TrialExtension(BaseModel):
    """Give either days or calendar months (1 month: 10 Nov -> 10 Dec)."""
    days: int | None = Field(default=None, ge=1, le=90)
    months: int | None = Field(default=None, ge=1, le=3)

    @model_validator(mode="after")
    def one_length(self) -> "TrialExtension":
        if (self.days is None) == (self.months is None):
            raise ValueError("give days or months")
        return self


def _fail(err: admin_billing.BillingError) -> NoReturn:
    code = status.HTTP_404_NOT_FOUND if err.code.endswith("not_found") else status.HTTP_422_UNPROCESSABLE_ENTITY
    raise HTTPException(code, detail={"code": err.code}) from None


def _naive_utc(at: datetime | None) -> datetime | None:
    """The database keeps naive UTC; a browser sends an aware time."""
    if at is None or at.tzinfo is None:
        return at
    return at.astimezone(timezone.utc).replace(tzinfo=None)


@router.get("")
def billing(q: str = Query("", max_length=100), db: Session = Depends(get_db),
            _: User = Depends(get_current_admin)) -> dict:
    return admin_billing.overview(db, q=q)


@router.post("/payments", status_code=status.HTTP_201_CREATED)
def record_payment(data: NewPayment, db: Session = Depends(get_db),
                   admin: User = Depends(get_current_admin)) -> dict:
    try:
        p = admin_billing.record_payment(
            db, admin, user_id=data.user_id, plan=data.plan, amount_lkr=data.amount_lkr, method=data.method,
            reference=data.reference, note=data.note, paid_at=_naive_utc(data.paid_at))
    except admin_billing.BillingError as err:
        _fail(err)
    return {"id": p.id, "subscription_id": p.subscription_id}


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_payment(payment_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> None:
    admin_billing.remove_payment(db, payment_id)


@router.post("/students/{user_id}/extend-trial")
def extend_trial(user_id: int, data: TrialExtension, db: Session = Depends(get_db),
                 _: User = Depends(get_current_admin)) -> dict:
    try:
        return admin_billing.extend_trial(db, user_id, data.days or 0, months=data.months or 0)
    except admin_billing.BillingError as err:
        _fail(err)


@router.post("/subscriptions/{sub_id}/cancel")
def cancel_subscription(sub_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    try:
        return admin_billing.cancel_subscription(db, sub_id)
    except admin_billing.BillingError as err:
        _fail(err)
