"""A student's AI-tutor chats, kept on the server so they (and saved chats) follow the student.

The browser owns each chat and sends it whole; the student always comes from the session, never
the body. When two devices edit one chat, the newer edit (by the browser's updated_ms) wins.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tutor_conversation import TutorConversation
from app.models.user import User

router = APIRouter(prefix="/tutor/conversations", tags=["tutor"])

MAX_CONVERSATIONS = 300          # per student; the oldest unsaved chats make way
MAX_MESSAGES = 400               # per chat
CLIENT_ID = Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9.\-]+$")


class Message(BaseModel):
    model_config = ConfigDict(extra="allow")       # sources, hintLevel, error: kept as the browser sent them

    id: str = Field(max_length=64)
    role: Literal["user", "assistant"]
    content: str = Field(max_length=20000)
    at: int
    image: str | None = Field(default=None, max_length=120_000)     # thumbnail data URL (~5-30 KB)


class ConversationIn(BaseModel):
    title: str = Field(max_length=200)
    saved: bool = False
    hint_level: int = Field(default=0, ge=0, le=3)
    messages: list[Message] = Field(max_length=MAX_MESSAGES)
    created_ms: int = Field(ge=0)
    updated_ms: int = Field(ge=0)


def _out(c: TutorConversation) -> dict:
    return {"id": c.client_id, "title": c.title, "saved": c.saved, "hint_level": c.hint_level,
            "messages": c.messages, "created_ms": c.created_ms, "updated_ms": c.updated_ms}


def _find(db: Session, user_id: int, client_id: str) -> TutorConversation | None:
    return db.scalar(select(TutorConversation).where(TutorConversation.user_id == user_id,
                                                     TutorConversation.client_id == client_id))


def _trim(db: Session, user_id: int) -> None:
    """Keep at most MAX_CONVERSATIONS: drop the oldest chats that aren't saved."""
    ids = db.scalars(select(TutorConversation.id).where(TutorConversation.user_id == user_id,
                                                        TutorConversation.saved.is_(False))
                     .order_by(TutorConversation.updated_ms.desc()).offset(MAX_CONVERSATIONS)).all()
    if ids:
        db.execute(delete(TutorConversation).where(TutorConversation.id.in_(ids)))


@router.get("")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(TutorConversation).where(TutorConversation.user_id == user.id)
                      .order_by(TutorConversation.updated_ms.desc()).limit(MAX_CONVERSATIONS))
    return {"conversations": [_out(c) for c in rows]}


@router.put("/{client_id}")
def save_conversation(body: ConversationIn, client_id: str = CLIENT_ID,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Create or replace a chat. An older copy than the one stored is ignored, and the stored
    one is returned so the browser can catch up."""
    data = {"title": body.title[:120] or "Chat", "saved": body.saved, "hint_level": body.hint_level,
            "messages": [m.model_dump(exclude_none=True) for m in body.messages],
            "created_ms": body.created_ms, "updated_ms": body.updated_ms}
    row = _find(db, user.id, client_id)
    if row and row.updated_ms > body.updated_ms:
        return _out(row)
    if row:
        for key, value in data.items():
            setattr(row, key, value)
    else:
        row = TutorConversation(user_id=user.id, client_id=client_id, **data)
        db.add(row)
    try:
        db.flush()
        _trim(db, user.id)
        db.commit()
    except IntegrityError:            # the same new chat sent twice at once: the other request stored it
        db.rollback()
        row = _find(db, user.id, client_id)
        if row is None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "conflict"}) from None
    return _out(row)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(client_id: str = CLIENT_ID, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)) -> None:
    # Scoped to the student. Deleting a chat that is already gone is fine (another device did it).
    db.execute(delete(TutorConversation).where(TutorConversation.user_id == user.id,
                                               TutorConversation.client_id == client_id))
    db.commit()
