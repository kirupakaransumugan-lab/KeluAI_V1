"""Public price list for the /pricing page: the plans an admin set to show (Admin > Plans).

No login needed. Only what a visitor may see is returned: names, prices, descriptions and
the "best value" flag, never student counts or revenue."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.plans import list_plans

router = APIRouter(prefix="/plans", tags=["plans"])
PUBLIC_FIELDS = ("key", "billing", "price_lkr", "name_en", "name_ta", "blurb_en", "blurb_ta", "highlight")


@router.get("")
def public_plans(db: Session = Depends(get_db)) -> dict:
    return {"plans": [{f: p[f] for f in PUBLIC_FIELDS} for p in list_plans(db, visible_only=True)]}
