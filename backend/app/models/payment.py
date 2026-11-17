from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class Payment(Base):
    """Money a student paid for a plan: recorded by an admin (bank transfer, cash...) or by the
    Stripe webhook (method "card", `recorded_by_id` empty). Either way it also adds the
    subscription it paid for (`subscription_id`).

    `stripe_session_id` is unique, so a webhook Stripe delivers twice can't add a second plan."""

    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_paid_at", "paid_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    plan: Mapped[str] = mapped_column(String(20))                 # "monthly" | "annual"
    amount_lkr: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(20))               # bank_transfer | cash | card | other
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)   # bank slip / receipt no.
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime)
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
