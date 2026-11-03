import hmac
import secrets
from datetime import datetime, timedelta

import jwt
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.core.security import create_reset_token, decode_reset_token, hash_password, hash_reset_code
from app.models.password_reset import PasswordResetCode
from app.models.user import Medium, User
from app.repositories import user_repository


class InvalidCodeError(Exception):
    pass


class InvalidResetTokenError(Exception):
    pass


def can_send_new_code(last_sent_at: datetime | None, now: datetime) -> bool:
    """Decide whether this user may be emailed another reset code right now.

    last_sent_at is when their most recent code was created (None if never).
    Both are naive UTC datetimes.
    """
    # TODO(human): decide the resend policy (see the Learn by Doing note).
    return True


def request_code(db: Session, email: str) -> tuple[User, str] | None:
    """Create a fresh code for this email. Returns (user, code) to send, or None to send nothing.

    The endpoint answers the same way either way, so callers can't learn which emails exist.
    """
    user = user_repository.get_by_email(db, email)
    if user is None:
        return None

    now = utcnow()
    last_sent_at = db.scalar(
        select(PasswordResetCode.created_at)
        .where(PasswordResetCode.user_id == user.id)
        .order_by(PasswordResetCode.id.desc())
        .limit(1)
    )
    if not can_send_new_code(last_sent_at, now):
        return None

    # Only the newest code works: retire any still-open ones.
    db.execute(
        update(PasswordResetCode)
        .where(PasswordResetCode.user_id == user.id, PasswordResetCode.used_at.is_(None))
        .values(used_at=now)
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=hash_reset_code(user.id, code),
            attempts=0,
            expires_at=now + timedelta(minutes=get_settings().reset_code_minutes),
            created_at=now,
        )
    )
    db.commit()
    return user, code


def verify_code(db: Session, email: str, code: str) -> str:
    """Check the emailed code and return a short-lived reset token, or raise InvalidCodeError."""
    settings = get_settings()
    user = user_repository.get_by_email(db, email)
    if user is None:
        raise InvalidCodeError

    now = utcnow()
    # FOR UPDATE: two parallel guesses can't both read attempts=4 and get a 6th try.
    reset = db.scalar(
        select(PasswordResetCode)
        .where(
            PasswordResetCode.user_id == user.id,
            PasswordResetCode.used_at.is_(None),
            PasswordResetCode.expires_at > now,
        )
        .order_by(PasswordResetCode.id.desc())
        .limit(1)
        .with_for_update()
    )
    if reset is None or reset.attempts >= settings.reset_code_max_attempts:
        db.rollback()
        raise InvalidCodeError

    if not hmac.compare_digest(reset.code_hash, hash_reset_code(user.id, code)):
        reset.attempts += 1
        db.commit()
        raise InvalidCodeError

    db.commit()
    return create_reset_token(user.id, reset.id)


def reset_password(db: Session, reset_token: str, new_password: str) -> User:
    try:
        payload = decode_reset_token(reset_token)
        user_id, code_id = int(payload["sub"]), int(payload["rid"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise InvalidResetTokenError from None

    now = utcnow()
    reset = db.scalar(select(PasswordResetCode).where(PasswordResetCode.id == code_id).with_for_update())
    if reset is None or reset.user_id != user_id or reset.used_at is not None or reset.expires_at <= now:
        db.rollback()
        raise InvalidResetTokenError

    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise InvalidResetTokenError
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now  # signs out every older session
    reset.used_at = now
    db.commit()
    return user


_EMAIL_COPY = {
    Medium.en: (
        "Your KELU password reset code",
        "Hi {name},\n\n"
        "Your KELU password reset code is: {code}\n\n"
        "It expires in {minutes} minutes. If you didn't ask to reset your password, "
        "you can ignore this email; your password won't change.\n\n"
        "— KELU",
    ),
    Medium.ta: (
        "உங்கள் KELU கடவுச்சொல் மீட்டமைப்புக் குறியீடு",
        "வணக்கம் {name},\n\n"
        "உங்கள் KELU கடவுச்சொல் மீட்டமைப்புக் குறியீடு: {code}\n\n"
        "இது {minutes} நிமிடங்களில் காலாவதியாகும். நீங்கள் கடவுச்சொல்லை மீட்டமைக்கக் கோரவில்லை எனில், "
        "இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்; உங்கள் கடவுச்சொல் மாறாது.\n\n"
        "— KELU",
    ),
}


def reset_email(user: User, code: str) -> tuple[str, str]:
    """(subject, body) in the student's study medium."""
    medium = user.profile.medium if user.profile else Medium.en
    subject, body = _EMAIL_COPY[medium]
    first_name = user.full_name.split(" ")[0]
    return subject, body.format(name=first_name, code=code, minutes=get_settings().reset_code_minutes)
