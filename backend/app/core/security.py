import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

# bcrypt only looks at the first 72 bytes; Tamil characters are 3 bytes each in
# UTF-8, so the API caps passwords at 72 bytes instead of silently truncating.
BCRYPT_MAX_BYTES = 72

# Reset tokens carry this audience. Session decoding passes no audience, and PyJWT
# rejects any token that has one, so a reset token can never be used as a session.
RESET_AUDIENCE = "kelu:password-reset"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))


def create_access_token(user_id: int, role: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def create_reset_token(user_id: int, code_id: int) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "rid": code_id,  # the reset code it was minted from; single use via used_at
        "aud": RESET_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.reset_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_reset_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=RESET_AUDIENCE)


def hash_reset_code(user_id: int, code: str) -> str:
    # Keyed hash, not plain SHA-256: there are only a million 6-digit codes, so an
    # unkeyed hash leaked from the DB could be reversed instantly.
    key = get_settings().jwt_secret.encode("utf-8")
    return hmac.new(key, f"{user_id}:{code}".encode("ascii"), hashlib.sha256).hexdigest()
