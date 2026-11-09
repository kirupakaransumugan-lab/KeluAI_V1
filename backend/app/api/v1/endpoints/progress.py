"""Saving finished practice sets, and the student's progress report.

The student always comes from the session, never the body. Step counts are reported by the
browser (AI-written questions exist only there until banked), so they can only ever affect
that student's own report.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.rag.quiz import QUIZ_SIZE
from app.services import progress

log = logging.getLogger(__name__)
router = APIRouter(prefix="/progress", tags=["progress"])


class Answer(BaseModel):
    slot: int = Field(ge=1, le=QUIZ_SIZE)
    topic: str = Field(max_length=500)             # cut to fit when saved: a long name isn't an error
    steps_total: int = Field(ge=1, le=20)
    steps_right: int = Field(ge=0, le=20)

    @model_validator(mode="after")
    def right_within_total(self) -> "Answer":
        if self.steps_right > self.steps_total:
            raise ValueError("steps_right exceeds steps_total")
        return self


class AttemptRequest(BaseModel):
    set_id: int = Field(gt=0)
    lang: str = Field(default="en", pattern="^(en|ta)$")
    answers: list[Answer] = Field(min_length=1, max_length=QUIZ_SIZE)

    @model_validator(mode="after")
    def slots_are_unique(self) -> "AttemptRequest":
        if len({a.slot for a in self.answers}) != len(self.answers):
            raise ValueError("a slot appears twice")
        return self


@router.post("/attempts")
def save_attempt(req: AttemptRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Safe to retry: a set already saved answers {"recorded": false} and changes nothing."""
    answers = [progress.NewAnswer(a.slot, a.topic, a.steps_total, a.steps_right) for a in req.answers]
    try:
        return {"recorded": progress.record_set(db, user.id, req.set_id, "practice", req.lang, answers)}
    except Exception:
        db.rollback()
        log.exception("could not save practice set for user %s", user.id)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "progress_unavailable"}) from None


@router.get("/report")
def report(period: str = Query("30", alias="range", pattern="^(7|30|all)$"),
           user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    try:
        return progress.build_report(db, user, None if period == "all" else int(period))
    except Exception:
        log.exception("could not build progress report for user %s", user.id)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "progress_unavailable"}) from None


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """The home page cards: study plan, topics that need work, this week, and recent quizzes."""
    try:
        return progress.build_dashboard(db, user)
    except Exception:
        log.exception("could not build dashboard for user %s", user.id)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "progress_unavailable"}) from None
