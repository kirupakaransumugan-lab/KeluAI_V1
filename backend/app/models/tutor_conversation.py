from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.clock import utcnow
from app.core.database import Base


class TutorConversation(Base):
    """One AI-tutor chat, kept on the server so it follows the student to any device.

    The browser owns the conversation: it sends the whole chat (its id, title, messages) and the
    server stores it as given, so a chat is one row and syncing is one request. The browser's own
    copy is a cache that makes the page open instantly."""

    __tablename__ = "tutor_conversations"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_tutor_conversation_client"),
        Index("ix_tutor_conversations_user_updated", "user_id", "updated_ms"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[str] = mapped_column(String(64))          # the browser's id for the chat
    title: Mapped[str] = mapped_column(String(120))
    saved: Mapped[bool] = mapped_column(Boolean, default=False)  # bookmarked by the student
    hint_level: Mapped[int] = mapped_column(SmallInteger, default=0)
    messages: Mapped[list] = mapped_column(JSON)
    created_ms: Mapped[int] = mapped_column(BigInteger)         # browser timestamps (epoch ms), kept as sent
    updated_ms: Mapped[int] = mapped_column(BigInteger)         # newest wins when two devices edit one chat
    stored_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
