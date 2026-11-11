from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class AiUsage(Base):
    """One row per OpenRouter call, written by the client itself (app/rag/agent/openrouter_llm.py),
    so every feature is counted without each one remembering to log. No prompt or reply text is
    stored: only what it was for, the model, token counts, cost and whether it worked."""

    __tablename__ = "ai_usage"
    __table_args__ = (Index("ix_ai_usage_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    purpose: Mapped[str] = mapped_column(String(20))           # tutor | quiz | ocr | feedback_review | other
    model: Mapped[str] = mapped_column(String(120))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)   # only when OpenRouter reports it
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(String(200), nullable=True)
