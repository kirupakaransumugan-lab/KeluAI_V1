"""Admin-only user management. Everyone signs up as a student; an admin promotes
other accounts here (e.g. from Postman). The very first admin is made with
`python -m app.manage make-admin <email>`, since no admin exists yet to call this.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import Role, User
from app.repositories import user_repository
from app.schemas.auth import UserOut
from app.services import auth_service

router = APIRouter(prefix="/admin", tags=["admin"])


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
