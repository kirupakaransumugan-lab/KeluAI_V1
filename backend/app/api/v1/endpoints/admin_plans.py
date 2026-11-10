"""Admin > Plans (app/services/plans.py): the price list students see, and how each plan is doing."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import get_current_admin
from app.core.database import get_db
from app.models.user import User
from app.services import plans

router = APIRouter(prefix="/admin/plans", tags=["admin"])


class PlanChanges(BaseModel):
    name_en: str | None = Field(default=None, max_length=60)
    name_ta: str | None = Field(default=None, max_length=120)
    price_lkr: int | None = Field(default=None, ge=0, le=1_000_000)
    blurb_en: str | None = Field(default=None, max_length=255)
    blurb_ta: str | None = Field(default=None, max_length=500)
    is_visible: bool | None = None
    highlight: bool | None = None


@router.get("")
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    return plans.admin_overview(db)


@router.patch("/{key}")
def update_plan(key: Literal["free", "monthly", "until_exam", "class"], data: PlanChanges,
                db: Session = Depends(get_db), admin: User = Depends(get_current_admin)) -> dict:
    try:
        return plans.update_plan(db, admin, key, data.model_dump(exclude_unset=True))
    except plans.PlanError as err:
        code = status.HTTP_404_NOT_FOUND if err.code.endswith("not_found") else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(code, detail={"code": err.code}) from None
