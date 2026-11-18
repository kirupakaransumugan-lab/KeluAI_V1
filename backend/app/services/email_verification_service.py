"""Sign-up email verification: a 6-digit code proves the student owns the address.

Until then the account can only reach the verify screen (app.core.dependencies), so a made-up
email can't start a trial or use the AI. Codes follow the password-reset scheme: only an HMAC
is stored, 5 wrong tries retire the code, it expires, and only the newest one works.
"""
from __future__ import annotations

import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.core.security import hash_verify_code
from app.models.email_verification import EmailVerificationCode
from app.models.user import Medium, User


class InvalidCodeError(Exception):
    pass


@dataclass
class ResendRefused(Exception):
    retry_after: int          # seconds until another code may be sent


def _wait_seconds(db: Session, user: User, now: datetime) -> int:
    """0 if a new code may be sent now, else how many seconds to wait."""
    s = get_settings()
    last = db.scalar(select(func.max(EmailVerificationCode.created_at))
                     .where(EmailVerificationCode.user_id == user.id))
    if last and (now - last).total_seconds() < s.verify_resend_seconds:
        return s.verify_resend_seconds - int((now - last).total_seconds())
    hour_ago = now - timedelta(hours=1)
    recent = db.scalars(select(EmailVerificationCode.created_at)
                        .where(EmailVerificationCode.user_id == user.id, EmailVerificationCode.created_at > hour_ago)
                        .order_by(EmailVerificationCode.created_at)).all()
    if len(recent) >= s.verify_max_per_hour:
        return max(1, int((recent[0] + timedelta(hours=1) - now).total_seconds()))
    return 0


def issue_code(db: Session, user: User) -> str:
    """A fresh code for this user (the caller emails it). Raises ResendRefused when too soon."""
    now = utcnow()
    wait = _wait_seconds(db, user, now)
    if wait:
        raise ResendRefused(wait)
    # Only the newest code works: retire any still-open ones.
    db.execute(update(EmailVerificationCode)
               .where(EmailVerificationCode.user_id == user.id, EmailVerificationCode.used_at.is_(None))
               .values(used_at=now))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailVerificationCode(user_id=user.id, code_hash=hash_verify_code(user.id, code), attempts=0,
                                 expires_at=now + timedelta(minutes=get_settings().verify_code_minutes),
                                 created_at=now))
    db.commit()
    return code


def verify(db: Session, user: User, code: str) -> None:
    """Mark the email verified, or raise InvalidCodeError."""
    if user.email_verified_at is not None:
        return
    now = utcnow()
    # FOR UPDATE: two parallel guesses can't both read attempts=4 and get a 6th try.
    row = db.scalar(select(EmailVerificationCode)
                    .where(EmailVerificationCode.user_id == user.id, EmailVerificationCode.used_at.is_(None),
                           EmailVerificationCode.expires_at > now)
                    .order_by(EmailVerificationCode.id.desc()).limit(1).with_for_update())
    if row is None or row.attempts >= get_settings().verify_code_max_attempts:
        db.rollback()
        raise InvalidCodeError
    if not hmac.compare_digest(row.code_hash, hash_verify_code(user.id, code)):
        row.attempts += 1
        db.commit()
        raise InvalidCodeError
    row.used_at = now
    user.email_verified_at = now
    db.commit()


_EMAIL_COPY = {
    Medium.en: (
        "Your KELU verification code",
        "Hi {name},\n\n"
        "Welcome to KELU! Your verification code is: {code}\n\n"
        "Enter it on the KELU page to finish creating your account. It expires in {minutes} minutes.\n"
        "If you didn't sign up for KELU, you can ignore this email.\n\n"
        "— KELU",
    ),
    Medium.ta: (
        "உங்கள் KELU சரிபார்ப்புக் குறியீடு",
        "வணக்கம் {name},\n\n"
        "KELU-க்கு வரவேற்கிறோம்! உங்கள் சரிபார்ப்புக் குறியீடு: {code}\n\n"
        "உங்கள் கணக்கை உருவாக்கி முடிக்க, இதை KELU பக்கத்தில் உள்ளிடுங்கள். இது {minutes} நிமிடங்களில் காலாவதியாகும்.\n"
        "நீங்கள் KELU-வில் பதிவு செய்யவில்லை எனில், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.\n\n"
        "— KELU",
    ),
}


def verification_email(user: User, code: str) -> tuple[str, str]:
    """(subject, body) in the student's study medium."""
    medium = user.profile.medium if user.profile else Medium.en
    subject, body = _EMAIL_COPY[medium]
    return subject, body.format(name=user.full_name.split(" ")[0], code=code,
                                minutes=get_settings().verify_code_minutes)
