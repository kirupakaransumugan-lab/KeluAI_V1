"""Admin: have the AI write drafts for the 10-question whole-syllabus quiz, then review them.

Drafts are never served to students. A person publishes each one, because the AI's working
and answers can be wrong; rejecting one deletes it.
"""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import get_current_admin
from app.core.database import SessionLocal, get_db
from app.models.quiz_bank import QuizBankQuestion
from app.models.quiz_job import QuizGenerationJob
from app.models.user import User
from app.rag.types import AccessScope
from app.services import quiz_jobs
from app.services.topics import TOPICS, Topic, by_id

log = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/quiz-bank", tags=["admin"])
LANG = "^(en|ta)$"


class GenerateRequest(BaseModel):
    lang: str = Field(default="en", pattern=LANG)


def run_generation(job_id: int, topics: list[Topic], lang: str) -> None:
    """Runs after the response has gone back. Building the generator loads the embedding model
    and needs the AI key, so it happens here, not during the admin's request."""
    from app.api.v1.endpoints.tutor import get_admin_quiz_generator

    try:
        generator = get_admin_quiz_generator()      # LLM_API_KEY2: admin work only
    except Exception:
        log.exception("quiz job %s: the AI could not be set up", job_id)
        quiz_jobs.fail_job(job_id, SessionLocal)
        return
    scope = AccessScope(user_id=0, role="admin", include_private=False)     # the global library only

    def write(topic: Topic):
        return generator.generate_for_topic(scope=scope, language=lang, slot=1, topic=topic)

    try:
        quiz_jobs.run_job(job_id, topics, write, SessionLocal)
    except Exception:
        log.exception("quiz job %s failed", job_id)
        quiz_jobs.fail_job(job_id, SessionLocal)


def get_job_runner():
    return run_generation


def _job_out(job: QuizGenerationJob | None) -> dict | None:
    return job and {"id": job.id, "status": job.status, "requested": job.requested, "added": job.added,
                    "failed": job.failed, "started_at": f"{job.started_at.isoformat()}Z"}


def _draft_out(row: QuizBankQuestion) -> dict:
    topic = by_id(row.topic_id) if row.topic_id else None
    return {"id": row.id, "topic": row.topic, "strand": topic.strand if topic else None, "question": row.question,
            "answer": row.answer, "steps": row.steps, "modelled_on": row.modelled_on}


@router.get("")
def overview(lang: str = Query("en", pattern=LANG), db: Session = Depends(get_db),
             _: User = Depends(get_current_admin)) -> dict:
    """Polled while a set is being written, so it stays a handful of small queries."""
    blocked = quiz_jobs.blocked_reason(db, lang)
    published: dict[int, int] = {}
    drafts: dict[int, int] = {}
    for topic_id, state, n in db.execute(
            select(QuizBankQuestion.topic_id, QuizBankQuestion.status, func.count())
            .where(QuizBankQuestion.lang == lang).group_by(QuizBankQuestion.topic_id, QuizBankQuestion.status)):
        (drafts if state == "draft" else published)[topic_id] = n
    rows = db.scalars(select(QuizBankQuestion).where(QuizBankQuestion.lang == lang, QuizBankQuestion.status == "draft")
                      .order_by(QuizBankQuestion.id))
    return {
        "blocked": blocked,
        "job": _job_out(quiz_jobs.latest_job(db, lang)),
        "topics": [{"key": t.key, "strand": t.strand, "name": t.en, "published": published.get(t.id, 0),
                    "drafts": drafts.get(t.id, 0)} for t in TOPICS],
        "drafts": [_draft_out(r) for r in rows],
    }


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate(req: GenerateRequest, background: BackgroundTasks, db: Session = Depends(get_db),
             admin: User = Depends(get_current_admin), runner=Depends(get_job_runner)) -> dict:
    """Start today's set, on the emptiest topics. The drafts arrive over the next few minutes."""
    blocked = quiz_jobs.blocked_reason(db, req.lang)
    if blocked:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": blocked})
    topics = quiz_jobs.emptiest_topics(db, req.lang)
    job = quiz_jobs.start_job(db, req.lang, admin.id, len(topics))
    background.add_task(runner, job.id, topics, req.lang)
    return _job_out(job)


def _draft(db: Session, draft_id: int) -> QuizBankQuestion:
    row = db.get(QuizBankQuestion, draft_id)
    if row is None or row.status != "draft":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "draft_not_found"})
    return row


@router.post("/drafts/{draft_id}/publish")
def publish(draft_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    _draft(db, draft_id).status = "published"
    db.commit()
    return {"id": draft_id, "status": "published"}


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
def reject(draft_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> None:
    db.delete(_draft(db, draft_id))
    db.commit()
