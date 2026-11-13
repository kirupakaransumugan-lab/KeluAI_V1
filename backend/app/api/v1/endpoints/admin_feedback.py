"""Admin: student reports on practice questions, with an optional AI second opinion.

Reports show no student details: the admin is judging the maths, not the student.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import get_current_admin
from app.core.database import get_db
from app.models.question_feedback import QuestionFeedback
from app.models.user import User
from app.rag.config import get_rag_settings
from app.services import question_feedback as feedback

log = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/feedback", tags=["admin"])


def get_review_llm():
    from app.api.v1.endpoints.tutor import _admin_llm

    return _admin_llm("feedback_review")        # LLM_API_KEY2: admin work only


def _open(db: Session, feedback_id: int) -> QuestionFeedback:
    row = db.get(QuestionFeedback, feedback_id)
    if row is None or row.status != "open":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "feedback_not_found"})
    return row


def _out(row: QuestionFeedback) -> dict:
    return {
        "id": row.id, "kind": row.kind, "message": row.message, "has_image": bool(row.image_name),
        "created_at": f"{row.created_at.isoformat()}Z", "question": row.question_snapshot,
        "ai": row.ai_verdict and {"verdict": row.ai_verdict, "reason": row.ai_reason},
    }


@router.get("")
def open_reports(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    rows = db.scalars(select(QuestionFeedback).where(QuestionFeedback.status == "open").order_by(QuestionFeedback.id))
    return {"reports": [_out(row) for row in rows]}


@router.get("/{feedback_id}/image")
def image(feedback_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> FileResponse:
    row = _open(db, feedback_id)
    path = feedback.image_path(row)
    if path is None or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "image_not_found"})
    # The type comes from the checked extension; nosniff stops a browser guessing another.
    return FileResponse(path, media_type=feedback.MEDIA_TYPES[path.suffix.lstrip(".")],
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.post("/{feedback_id}/review")
def review(feedback_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin),
           llm=Depends(get_review_llm)) -> dict:
    """Plain `def`: the AI call can take minutes, and this runs in a worker thread."""
    row = _open(db, feedback_id)
    s = get_rag_settings()
    try:
        feedback.review(db, row, llm, s.admin_quiz_model or s.quiz_model or s.llm_model, s.ocr_model)
    except Exception:
        log.exception("AI review of feedback %s failed", feedback_id)
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "review_failed"}) from None
    return _out(row)


@router.post("/{feedback_id}/close")
def close(feedback_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    feedback.close(db, _open(db, feedback_id))
    return {"id": feedback_id, "status": "closed"}
