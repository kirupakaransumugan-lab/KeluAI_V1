from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class Plan(Base):
    """What an admin has changed about a plan: its names, price, description and whether it shows.

    The plan keys and how each one bills (free / a month / until the A/L exam / per student a
    month) are fixed in app/services/plans.py, because subscriptions depend on them. A key with
    no row here uses the defaults from that file, so a new database works with no seeding."""

    __tablename__ = "plans"

    key: Mapped[str] = mapped_column(String(20), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(60))
    name_ta: Mapped[str] = mapped_column(String(120))
    price_lkr: Mapped[int] = mapped_column(Integer)
    blurb_en: Mapped[str] = mapped_column(String(255))
    blurb_ta: Mapped[str] = mapped_column(String(500))
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)    # shown to students
    highlight: Mapped[bool] = mapped_column(Boolean, default=False)    # the "best value" card
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
