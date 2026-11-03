from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.core.google_auth import GoogleIdentity
from app.core.security import BCRYPT_MAX_BYTES, hash_password, verify_password
from app.models.user import Role, StudentProfile, Subscription, SubscriptionStatus, User
from app.repositories import user_repository
from app.schemas.auth import RegisterRequest, StudentProfileFields, UserOut


class EmailTakenError(Exception):
    pass


class ProfileRequiredError(Exception):
    """First Google sign-in: we know who they are, but not their mobile/medium/exam year yet."""

    def __init__(self, identity: GoogleIdentity):
        self.identity = identity


def _new_student(
    *, full_name: str, email: str, profile: StudentProfileFields, password_hash: str | None, google_sub: str | None
) -> User:
    """Build the user, their student profile and a 14-day trial (caller commits)."""
    now = utcnow()
    user = User(
        full_name=full_name,
        email=email,
        mobile=profile.mobile,
        password_hash=password_hash,
        google_sub=google_sub,
        role=Role.student,
        terms_accepted_at=now,
    )
    user.profile = StudentProfile(medium=profile.medium, al_exam_year=profile.al_exam_year)
    user.subscriptions.append(
        Subscription(
            plan="trial",
            status=SubscriptionStatus.trialing,
            starts_at=now,
            ends_at=now + timedelta(days=get_settings().trial_days),
        )
    )
    return user


def _commit_new_user(db: Session, user: User) -> User:
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two sign-ups with the same email raced past the check;
        # the unique index on users.email is the real guarantee.
        db.rollback()
        raise EmailTakenError from None
    return user


def register_student(db: Session, data: RegisterRequest) -> User:
    if user_repository.get_by_email(db, data.email):
        raise EmailTakenError
    user = _new_student(
        full_name=data.full_name,
        email=data.email,
        profile=data,
        password_hash=hash_password(data.password),
        google_sub=None,
    )
    return _commit_new_user(db, user)


def google_sign_in(db: Session, identity: GoogleIdentity, profile: StudentProfileFields | None) -> User:
    """Log in, link, or create the account for a verified Google identity."""
    user = user_repository.get_by_google_sub(db, identity.sub)
    if user:
        return user

    user = user_repository.get_by_email(db, identity.email)
    if user:
        # Google has verified they own this inbox, so linking to the existing
        # email account is safe; from now on either login method works.
        user.google_sub = identity.sub
        db.commit()
        return user

    if profile is None:
        raise ProfileRequiredError(identity)
    user = _new_student(
        full_name=identity.full_name[:120],
        email=identity.email,
        profile=profile,
        password_hash=None,
        google_sub=identity.sub,
    )
    return _commit_new_user(db, user)


# Hash compared against when the email is unknown, so a missing account takes as
# long to reject as a wrong password (otherwise timing reveals who has an account).
_DUMMY_HASH = hash_password("kelu-timing-equaliser")


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = user_repository.get_by_email(db, email)
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        return None  # can never match: sign-up rejects passwords this long
    if user is None or user.password_hash is None:
        # Unknown email, or a Google-only account with no password set.
        verify_password(password, _DUMMY_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def to_user_out(user: User) -> UserOut:
    trial = next((s for s in user.subscriptions if s.plan == "trial"), None)
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        medium=user.profile.medium if user.profile else None,
        al_exam_year=user.profile.al_exam_year if user.profile else None,
        trial_ends_at=trial.ends_at if trial else None,
    )
