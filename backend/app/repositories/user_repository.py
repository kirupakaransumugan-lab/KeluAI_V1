from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.user import User


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_by_google_sub(db: Session, google_sub: str) -> User | None:
    return db.scalar(select(User).where(User.google_sub == google_sub))


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.profile), selectinload(User.subscriptions))
    )
