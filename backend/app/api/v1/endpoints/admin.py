"""Admin-only user management. Everyone signs up as a student; an admin promotes
other accounts here (e.g. from Postman). The very first admin is made with
`python -m app.manage make-admin <email>`, since no admin exists yet to call this.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import Medium, Role, User
from app.repositories import user_repository
from app.schemas.auth import UserOut
from app.services import admin_attention, admin_overview, admin_students, ai_usage, auth_service

router = APIRouter(prefix="/admin", tags=["admin"])
OVERVIEW_DAYS = [7, 30, 90]         # the date-range presets on the Overview page


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    # The role is read from the database on every request (get_current_user), so a
    # demoted admin loses access at once, even with an older session cookie.
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "admin_only"})
    return user


class RoleUpdate(BaseModel):
    role: Role


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> list[UserOut]:
    users = db.scalars(
        select(User).order_by(User.id).options(selectinload(User.profile), selectinload(User.subscriptions))
    )
    return [auth_service.to_user_out(u) for u in users]


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_role(user_id: int, data: RoleUpdate, db: Session = Depends(get_db),
             admin: User = Depends(get_current_admin)) -> UserOut:
    if user_id == admin.id and data.role != Role.admin:
        # Stops the last admin locking everyone out by demoting themselves.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "cannot_demote_self"})
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found"})
    user.role = data.role
    db.commit()
    return auth_service.to_user_out(user)


@router.get("/overview")
def overview(days: int = Query(30), medium: Literal["all", "en", "ta"] = Query("all"),
             db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    """Overview page numbers for the last `days`, optionally one study medium only."""
    # Checked by hand: a Literal[7, 30, 90] query param rejects the string "7" from the URL.
    if days not in OVERVIEW_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "bad_range", "allowed": OVERVIEW_DAYS})
    data = admin_overview.overview(db, days=days, medium=None if medium == "all" else Medium(medium))
    # Not scoped by the filters: they are about the whole platform right now.
    data["attention"] = admin_attention.items(db)
    data["ai_usage"] = ai_usage.summary(db)
    return data


# ---------- Students ----------

class StudentStatus(BaseModel):
    active: bool


def _student_or_404(db: Session, user_id: int) -> User:
    user = admin_students.get_student(db, user_id)
    if user is None:          # also for admins: they are not managed from this page
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "student_not_found"})
    return user


@router.get("/students")
def students(q: str = Query("", max_length=100), medium: Literal["all", "en", "ta"] = Query("all"),
             db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    return {"students": admin_students.list_students(db, q=q, medium=None if medium == "all" else Medium(medium)),
            "limit": admin_students.LIST_LIMIT}


@router.get("/students/{user_id}")
def student_detail(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    return admin_students.detail(db, _student_or_404(db, user_id))


@router.patch("/students/{user_id}/status")
def set_student_status(user_id: int, data: StudentStatus, db: Session = Depends(get_db),
                       _: User = Depends(get_current_admin)) -> dict:
    """Switch a student's account off (no log-in, current sessions end) or back on."""
    user = _student_or_404(db, user_id)
    user.is_active = data.active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}
