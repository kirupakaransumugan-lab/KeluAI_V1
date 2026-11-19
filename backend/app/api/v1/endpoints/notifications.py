"""GET /notifications: the signed-in student's bell (app/services/notifications.py)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import Role, User
from app.services import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if user.role != Role.student:
        return {"items": []}
    items = notifications.for_student(db, user)
    return {"items": [{**i, "at": i["at"].isoformat() + "Z"} for i in items]}
