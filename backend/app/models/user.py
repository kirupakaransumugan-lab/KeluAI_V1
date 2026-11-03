import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Role(str, enum.Enum):
    student = "student"
    admin = "admin"  # created by the backend CLI only, never via /auth/register


class Medium(str, enum.Enum):
    ta = "ta"
    en = "en"


class SubscriptionStatus(str, enum.Enum):
    trialing = "trialing"
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    # Store the enum *values* ("ta"), not member names, so the DB stays readable.
    return Enum(e, name=name, values_callable=lambda x: [m.value for m in x])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    mobile: Mapped[str] = mapped_column(String(16))  # E.164, e.g. +94771234567
    # None for accounts created through Google that never set a password.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Google's stable account id ("sub" claim). Emails can change; this can't.
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    # Session tokens issued before this moment are rejected (set on password reset).
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    role: Mapped[Role] = mapped_column(_enum(Role, "user_role"), default=Role.student)
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    profile: Mapped["StudentProfile"] = relationship(back_populates="user", uselist=False)
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    medium: Mapped[Medium] = mapped_column(_enum(Medium, "study_medium"))
    al_exam_year: Mapped[int] = mapped_column(SmallInteger)
    parent_email: Mapped[str | None] = mapped_column(String(254), nullable=True)

    user: Mapped[User] = relationship(back_populates="profile")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan: Mapped[str] = mapped_column(String(20))  # "trial" | "monthly" | "annual"
    status: Mapped[SubscriptionStatus] = mapped_column(_enum(SubscriptionStatus, "subscription_status"))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship(back_populates="subscriptions")
