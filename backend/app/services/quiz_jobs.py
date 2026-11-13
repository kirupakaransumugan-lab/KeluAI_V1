"""Admins ask the AI for a set of draft questions for the 10-question whole-syllabus quiz.
Nothing reaches students until a person has reviewed it.

A set takes minutes (one question can take around two minutes on a free model), so it runs
after the request returns and saves each draft as it arrives. The page polls for progress.

The job runs inside the API process, so restarting the server ends it. Drafts already saved
are kept, and a job still "running" after STALE_AFTER is treated as dead so it can't block
the next one forever.
"""
from __future__ import annotations

import logging
import random
import threading
from concurrent.futures import CancelledError, ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.quiz_bank import QuizBankQuestion
from app.models.quiz_job import QuizGenerationJob
from app.rag.quiz import QUIZ_SIZE, QuizQuestion
from app.services import quiz_bank
from app.services.progress import COLOMBO, local_day
from app.services.topics import TOPICS, Topic

log = logging.getLogger(__name__)

DAILY_SETS = 1
WORKERS = 3                     # free models queue extra requests, so more isn't faster
STALE_AFTER = timedelta(minutes=30)
STOP_AFTER_FAILURES = 3         # in a row: a used-up quota or a broken model chain. Each failure
                                # can cost 2+ requests (a retry, model fallbacks) on a 50/day free
                                # quota, so stop early rather than burn the day's requests


class _Skipped(Exception):
    """A topic not attempted because the set was stopped first."""


def _clear_stale(db: Session, now: datetime) -> None:
    for job in db.scalars(select(QuizGenerationJob).where(QuizGenerationJob.status == "running",
                                                          QuizGenerationJob.started_at < now - STALE_AFTER)):
        job.status, job.finished_at = "failed", now
    db.commit()


def latest_job(db: Session, lang: str) -> QuizGenerationJob | None:
    return db.scalars(select(QuizGenerationJob).where(QuizGenerationJob.lang == lang)
                      .order_by(desc(QuizGenerationJob.id)).limit(1)).first()


def blocked_reason(db: Session, lang: str, now: datetime | None = None) -> str | None:
    """Why a new set can't start, or None. Only a set that produced drafts uses up the day."""
    now = now or utcnow()
    _clear_stale(db, now)
    if db.scalar(select(func.count()).select_from(QuizGenerationJob).where(QuizGenerationJob.status == "running")):
        return "job_running"
    day_start = datetime.combine(local_day(now), datetime.min.time()) - COLOMBO
    done_today = db.scalar(select(func.count()).select_from(QuizGenerationJob).where(
        QuizGenerationJob.lang == lang, QuizGenerationJob.added > 0, QuizGenerationJob.started_at >= day_start))
    return "daily_set_done" if done_today >= DAILY_SETS else None


def emptiest_topics(db: Session, lang: str, rng: random.Random | None = None) -> list[Topic]:
    """The 5 Pure and 5 Applied topics with the fewest questions, counting drafts so a set isn't
    asked for twice. Ties are random, so the same few topics don't always go first."""
    rng = rng or random.Random()
    rows = db.execute(select(QuizBankQuestion.topic_id, func.count()).where(QuizBankQuestion.lang == lang)
                      .group_by(QuizBankQuestion.topic_id)).all()
    have = dict(rows)
    ordered = sorted(TOPICS, key=lambda t: (have.get(t.id, 0), rng.random()))
    half = QUIZ_SIZE // 2
    return [t for t in ordered if t.strand == "pure"][:half] + [t for t in ordered if t.strand == "applied"][:half]


def start_job(db: Session, lang: str, admin_id: int, requested: int) -> QuizGenerationJob:
    job = QuizGenerationJob(lang=lang, requested=requested, added=0, failed=0, status="running", created_by=admin_id)
    db.add(job)
    db.commit()
    return job


def fail_job(job_id: int, session_factory: Callable[[], Session]) -> None:
    with session_factory() as db:
        job = db.get(QuizGenerationJob, job_id)
        job.status, job.finished_at = "failed", utcnow()
        db.commit()


def run_job(job_id: int, topics: list[Topic], write: Callable[[Topic], QuizQuestion],
            session_factory: Callable[[], Session]) -> None:
    """Write one draft per topic. Database work stays on this thread; only the AI calls run in
    parallel. Progress is committed after every question, so the page sees it as it happens."""
    stop = threading.Event()

    def attempt(topic: Topic) -> QuizQuestion:
        if stop.is_set():                   # checked before spending a request, not after
            raise _Skipped
        return write(topic)

    with session_factory() as db:
        job = db.get(QuizGenerationJob, job_id)
        misses = skipped = 0
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(attempt, topic) for topic in topics]
            for future in as_completed(futures):
                try:
                    question = future.result()
                except (_Skipped, CancelledError):
                    skipped += 1            # never asked: not a failure
                    continue
                except Exception:
                    log.exception("quiz job %s: a question failed", job_id)
                    question = None
                saved = question is not None and quiz_bank.add_new(db, job.lang, question, status="draft")[1]
                job.added += saved
                job.failed += not saved
                db.commit()
                misses = 0 if saved else misses + 1
                if misses >= STOP_AFTER_FAILURES and not stop.is_set():
                    stop.set()
                    for other in futures:
                        other.cancel()
        job.status = "stopped" if skipped else "finished"
        job.finished_at = utcnow()
        db.commit()
