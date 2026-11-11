from datetime import timedelta
from typing import Literal

from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.core.social_identity import SocialIdentity
from app.core.security import BCRYPT_MAX_BYTES, hash_password, verify_password
from app.models.password_reset import PasswordResetCode
from app.models.progress import PracticeAnswer
from app.models.question_feedback import QuestionFeedback
from app.models.quiz_job import QuizGenerationJob
from app.models.saved_question import SavedQuestion
from app.models.tutor_conversation import TutorConversation
from app.models.user import Role, StudentProfile, Subscription, SubscriptionStatus, User
from app.repositories import user_repository
from app.schemas.auth import RegisterRequest, StudentProfileFields, UpdateProfileRequest, UserOut


class EmailTakenError(Exception):
    pass


class ProfileRequiredError(Exception):
    """First Google/Microsoft sign-in: we know who they are, but not their mobile/medium/exam year yet."""

    def __init__(self, identity: SocialIdentity):
        self.identity = identity


def _new_student(
    *, full_name: str, email: str, profile: StudentProfileFields, password_hash: str | None,
    google_sub: str | None = None, microsoft_sub: str | None = None,
) -> User:
    """Build the user, their student profile and a 14-day trial (caller commits)."""
    now = utcnow()
    user = User(
        full_name=full_name,
        email=email,
        mobile=profile.mobile,
        password_hash=password_hash,
        google_sub=google_sub,
        microsoft_sub=microsoft_sub,
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


Provider = Literal["google", "microsoft"]
_FIND_BY_SUB = {"google": user_repository.get_by_google_sub, "microsoft": user_repository.get_by_microsoft_sub}


def social_sign_in(db: Session, provider: Provider, identity: SocialIdentity,
                   profile: StudentProfileFields | None) -> User:
    """Log in, link, or create the account for a verified Google or Microsoft identity."""
    sub_field = f"{provider}_sub"
    user = _FIND_BY_SUB[provider](db, identity.sub)
    if user:
        return user

    user = user_repository.get_by_email(db, identity.email)
    if user:
        # The provider has verified they own this inbox (microsoft_auth refuses unverified
        # emails), so linking to the existing account is safe; from now on any login method works.
        setattr(user, sub_field, identity.sub)
        db.commit()
        return user

    if profile is None:
        raise ProfileRequiredError(identity)
    user = _new_student(
        full_name=identity.full_name[:120],
        email=identity.email,
        profile=profile,
        password_hash=None,
        **{sub_field: identity.sub},
    )
    return _commit_new_user(db, user)


def google_sign_in(db: Session, identity: SocialIdentity, profile: StudentProfileFields | None) -> User:
    return social_sign_in(db, "google", identity, profile)


# Hash compared against when the email is unknown, so a missing account takes as
# long to reject as a wrong password (otherwise timing reveals who has an account).
_DUMMY_HASH = hash_password("kelu-timing-equaliser")


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = user_repository.get_by_email(db, email)
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        return None  # can never match: sign-up rejects passwords this long
    if user is None or user.password_hash is None:
        # Unknown email, or a Google/Microsoft-only account with no password set.
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
        mobile=user.mobile,
        parent_email=user.profile.parent_email if user.profile else None,
        has_password=user.password_hash is not None,
    )


# ---------- Settings ----------

class WrongPasswordError(Exception):
    pass


class ConfirmationMismatchError(Exception):
    pass


class AdminAccountError(Exception):
    """Admin accounts are managed with the backend CLI, not deleted from the app."""


def _password_ok(user: User, password: str | None) -> bool:
    return bool(password) and len(password.encode("utf-8")) <= BCRYPT_MAX_BYTES \
        and verify_password(password, user.password_hash)


def update_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.mobile is not None:
        user.mobile = data.mobile
    if user.profile:                        # admins have no student profile: these don't apply
        if data.medium is not None:
            user.profile.medium = data.medium
        if data.al_exam_year is not None:
            user.profile.al_exam_year = data.al_exam_year
        if data.clear_parent_email:
            user.profile.parent_email = None
        elif data.parent_email is not None:
            user.profile.parent_email = data.parent_email
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current: str | None, new: str) -> User:
    """Google-only accounts (no password yet) may set one without a current password."""
    if user.password_hash is not None and not _password_ok(user, current):
        raise WrongPasswordError
    user.password_hash = hash_password(new)
    user.password_changed_at = utcnow()     # signs out every other session
    db.commit()
    return user


def delete_account(db: Session, user: User, confirm_email: str, password: str | None) -> None:
    """Delete the student and everything that belongs to them. Rows are deleted explicitly,
    not left to ON DELETE CASCADE, so it works the same on every database."""
    if user.role == Role.admin:
        raise AdminAccountError
    if confirm_email.strip().lower() != user.email.lower():
        raise ConfirmationMismatchError
    if user.password_hash is not None and not _password_ok(user, password):
        raise WrongPasswordError
    uid = user.id
    for model in (PracticeAnswer, SavedQuestion, TutorConversation, QuestionFeedback, PasswordResetCode, Subscription):
        db.execute(delete(model).where(model.user_id == uid))
    db.execute(update(QuizGenerationJob).where(QuizGenerationJob.created_by == uid).values(created_by=None))
    db.execute(delete(StudentProfile).where(StudentProfile.user_id == uid))
    db.execute(delete(User).where(User.id == uid))
    db.commit()
