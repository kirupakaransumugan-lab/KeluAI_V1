"""What a student picks a practice quiz from, and reports on a question they took.
Questions come from POST /tutor/quiz/question (a subject) or /tutor/quiz/set (the whole syllabus)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import progress, question_feedback, quiz_bank, quiz_plan

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


class QuestionSnapshot(BaseModel):
    topic: str = Field(max_length=200)
    question: str = Field(min_length=1, max_length=8000)
    answer: str = Field(max_length=4000)


class FeedbackRequest(BaseModel):
    kind: Literal["mistake", "method"]
    message: str = Field(min_length=1, max_length=2000)
    question: QuestionSnapshot
    # Base64: about 4/3 of the file, so this bound lets the service give the exact size error.
    image_base64: str | None = Field(default=None, max_length=8_000_000)


@router.get("/subjects")
def subjects(lang: str = Query("en", pattern="^(en|ta)$"), user: User = Depends(get_current_user),
             db: Session = Depends(get_db)) -> dict:
    """Every syllabus subject with the student's score (None: not tried yet) and quiz history,
    and what the whole-syllabus quiz can offer them."""
    return {"subjects": progress.subject_scores(db, user.id),
            "full_quiz": {"allowed": quiz_plan.can_take_full_quiz(user), **quiz_bank.strand_counts(db, lang)}}


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
def send_feedback(req: FeedbackRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    try:
        row = question_feedback.submit(db, user.id, req.question.model_dump(), req.kind, req.message.strip(), req.image_base64)
    except question_feedback.FeedbackError as e:
        raise HTTPException(e.status, detail={"code": e.code}) from None
    return {"id": row.id}
