"""Admin Overview > Needs attention: things an admin should act on, newest first.

Each item comes from data the app already records, and links to the page that deals with it:
  * open student reports on practice questions            -> Student Feedback
  * AI-written quiz drafts waiting for review              -> Quiz Bank
  * the latest quiz generation job stopped or failed       -> Quiz Bank
  * knowledge-base uploads that failed (since the restart) -> Knowledge Base
  * paid plans ending in the next 7 days, not yet renewed  -> Subscriptions & Payments
  * AI calls that failed today (quota, outage, bad key)     -> nothing to open; the reason is shown
Nothing is listed when there is nothing to do.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.models.question_feedback import QuestionFeedback
from app.models.quiz_bank import QuizBankQuestion
from app.models.quiz_job import QuizGenerationJob
from app.models.ai_usage import AiUsage
from app.models.user import Role, Subscription, SubscriptionStatus, User
from app.services import ai_usage, knowledge_base
from app.services.plans import PAID_KEYS

ENDING_DAYS = 7


def _iso(at: datetime | None) -> str | None:
    return f"{at.isoformat()}Z" if at else None


def _item(kind: str, severity: str, title: str, detail: str, count: int, at: datetime | None,
          link: str | None) -> dict:
    return {"kind": kind, "severity": severity, "title": title, "detail": detail, "count": count,
            "at": _iso(at), "link": link}


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def items(db: Session, now: datetime | None = None) -> list[dict]:
    now = now or utcnow()
    out: list[dict] = []

    n, newest = db.execute(select(func.count(QuestionFeedback.id), func.max(QuestionFeedback.created_at))
                           .where(QuestionFeedback.status == "open")).one()
    if n:
        out.append(_item("feedback", "warn", f"{_plural(n, 'student report')} to read",
                         "Students reported a mistake or shared another method on a practice question.",
                         n, newest, "/admin/feedback"))

    n, newest = db.execute(select(func.count(QuizBankQuestion.id), func.max(QuizBankQuestion.created_at))
                           .where(QuizBankQuestion.status == "draft")).one()
    if n:
        out.append(_item("drafts", "info", f"{_plural(n, 'quiz draft')} waiting for review",
                         "AI-written questions reach students only after you publish them.",
                         n, newest, "/admin/quiz-bank"))

    job = db.scalar(select(QuizGenerationJob).order_by(QuizGenerationJob.id.desc()).limit(1))
    if job is not None and job.status in ("stopped", "failed"):
        why = ("It stopped after several failed questions in a row, usually a used-up AI quota."
               if job.status == "stopped" else "The server stopped while it was running.")
        out.append(_item("quiz_job", "warn", f"Quiz generation {job.status}",
                         f"{why} {job.added} added, {job.failed} failed.", 1,
                         job.finished_at or job.started_at, "/admin/quiz-bank"))

    failed = [j for j in knowledge_base.list_jobs() if j["status"] == "failed"]
    if failed:
        last = failed[0]
        out.append(_item("kb_upload", "danger", f"{_plural(len(failed), 'knowledge-base job')} failed",
                         f"{last['filename']}: {last['message'] or 'failed'}", len(failed),
                         datetime.fromisoformat(last["finished_at"].rstrip("Z")) if last["finished_at"] else None,
                         "/admin/knowledge-base"))

    # Paid plans ending soon, for students with no later paid plan already recorded.
    soon = now + timedelta(days=ENDING_DAYS)
    students = db.scalars(select(User).where(User.role == Role.student, User.is_active.is_(True))
                          .options(selectinload(User.subscriptions))).all()
    ending = []
    for u in students:
        paid = [s for s in u.subscriptions if s.plan in PAID_KEYS and s.status != SubscriptionStatus.cancelled]
        live = [s for s in paid if s.starts_at <= now < s.ends_at]
        if live and max(s.ends_at for s in paid) <= soon:
            ending.append((max(s.ends_at for s in paid), u))
    if ending:
        ending.sort(key=lambda e: e[0])
        names = ", ".join(u.full_name for _, u in ending[:3]) + (" and more" if len(ending) > 3 else "")
        out.append(_item("plans_ending", "info", f"{_plural(len(ending), 'paid plan')} ending within {ENDING_DAYS} days",
                         f"{names}. Remind them to renew, or record their payment.", len(ending), now,
                         "/admin/payments"))

    today0, _ = ai_usage.colombo_midnights(now)
    n, newest = ai_usage.failed_since(db, today0)
    if n:
        reason = db.scalar(select(AiUsage.error).where(AiUsage.created_at >= today0, AiUsage.ok.is_(False))
                           .order_by(AiUsage.id.desc()).limit(1))
        out.append(_item("ai_failures", "danger", f"{_plural(n, 'AI call')} failed today",
                         f"Latest error: {reason or 'unknown'}. Check the OpenRouter key, credit and model names.",
                         n, newest, None))

    return sorted(out, key=lambda i: i["at"] or "", reverse=True)
