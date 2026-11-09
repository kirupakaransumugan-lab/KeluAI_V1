"""The student's plan, trial days left and plan history (read only until payments are connected)."""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import subscription

router = APIRouter(prefix="/subscription", tags=["subscription"])


@router.get("")
def get_subscription(user: User = Depends(get_current_user)) -> dict:
    return subscription.summary(user)
