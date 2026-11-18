from datetime import datetime, timezone

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories import user_repository

ACCESS_COOKIE = "kelu_access"


def get_signed_in_user(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> User:
    """The session's user, verified email or not. Only for what the verify screen needs
    (who am I, verify, resend, log out, delete); everything else uses get_current_user."""
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "not_authenticated"})
    if not token:
        raise unauthorized
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        issued_at = datetime.fromtimestamp(int(payload["iat"]), timezone.utc).replace(tzinfo=None)
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise unauthorized from None
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise unauthorized
    if not user.is_active:
        # 401, not 403: the frontend sends a 401 to the log-in page, which explains it.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "account_disabled"})
    # A password reset signs out every session that existed before it.
    if user.password_changed_at and issued_at < user.password_changed_at:
        raise unauthorized
    return user


def get_current_user(user: User = Depends(get_signed_in_user)) -> User:
    """The signed-in user, once they have proved they own their email."""
    if user.email_verified_at is None:
        # 403, not 401: they are signed in; the frontend sends them to the verify screen.
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "email_unverified"})
    return user
