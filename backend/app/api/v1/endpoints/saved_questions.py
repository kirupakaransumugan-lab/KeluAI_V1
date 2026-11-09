"""A student's saved (bookmarked) practice questions. The student always comes from the session."""
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.saved_question import SavedQuestion
from app.models.user import User

router = APIRouter(prefix="/saved-questions", tags=["saved-questions"])

MAX_SAVED = 500          # per student: a list, not an archive
TEXT_MAX = 8000


class SaveRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)    # cut to fit when saved
    question: str = Field(min_length=1, max_length=TEXT_MAX)
    answer: str = Field(max_length=TEXT_MAX)


class ImportRequest(BaseModel):
    questions: list[SaveRequest] = Field(max_length=200)


def _hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _out(s: SavedQuestion) -> dict:
    return {"id": s.id, "topic": s.topic, "question": s.question, "answer": s.answer,
            "saved_at": f"{s.created_at.isoformat()}Z"}


def _find(db: Session, user_id: int, question: str) -> SavedQuestion | None:
    return db.scalar(select(SavedQuestion).where(SavedQuestion.user_id == user_id,
                                                 SavedQuestion.question_hash == _hash(question)))


def _count(db: Session, user_id: int) -> int:
    return len(db.scalars(select(SavedQuestion.id).where(SavedQuestion.user_id == user_id)).all())


def _save(db: Session, user_id: int, req: SaveRequest) -> tuple[SavedQuestion, bool]:
    """(row, created). Saving a question that is already saved returns the existing row."""
    existing = _find(db, user_id, req.question)
    if existing:
        return existing, False
    row = SavedQuestion(user_id=user_id, question_hash=_hash(req.question), topic=req.topic[:120],
                        question=req.question, answer=req.answer, created_at=utcnow())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:          # the same question saved twice at once: the other request won
        db.rollback()
        return _find(db, user_id, req.question), False
    return row, True


@router.get("")
def list_saved(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(SavedQuestion).where(SavedQuestion.user_id == user.id)
                      .order_by(SavedQuestion.created_at.desc(), SavedQuestion.id.desc()))
    return {"questions": [_out(r) for r in rows]}


@router.post("")
def save(req: SaveRequest, response: Response, user: User = Depends(get_current_user),
         db: Session = Depends(get_db)) -> dict:
    if not _find(db, user.id, req.question) and _count(db, user.id) >= MAX_SAVED:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "saved_limit", "limit": MAX_SAVED})
    row, created = _save(db, user.id, req)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return _out(row)


@router.post("/import")
def import_saved(req: ImportRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Move questions saved in this browser before saving went to the server. Repeats are skipped."""
    room = MAX_SAVED - _count(db, user.id)
    added = 0
    for q in req.questions:
        if added >= room:
            break
        added += _save(db, user.id, q)[1]
    return {"added": added}


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(saved_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    # Scoped to the student, so another student's id deletes nothing.
    result = db.execute(delete(SavedQuestion).where(SavedQuestion.id == saved_id, SavedQuestion.user_id == user.id))
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "not_found"})
