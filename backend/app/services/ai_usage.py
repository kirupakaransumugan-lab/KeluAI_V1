"""AI usage for the admin Overview: how many AI calls were made, how many tokens they used, and
what they cost, today and this month (Sri Lanka time).

Rows are written by the OpenRouter client after every call (see make_recorder and
app/rag/agent/openrouter_llm.set_usage_recorder), so tutor chat, quizzes, OCR and feedback reviews
are all counted. Cost is only summed from calls where OpenRouter reported one; the page says how
many calls that covers rather than guessing a price.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.ai_usage import AiUsage

COLOMBO = timedelta(hours=5, minutes=30)
TOP_MODELS = 5
PURPOSES = ("tutor", "quiz", "ocr", "feedback_review", "other")


def make_recorder(session_factory: Callable[[], Session]):
    """The function the OpenRouter client calls after each request: writes one ai_usage row."""
    def record(purpose: str, model: str, input_tokens: int, output_tokens: int,
               cost_usd: float | None, ok: bool, error: str | None) -> None:
        with session_factory() as db:
            db.add(AiUsage(purpose=(purpose or "other")[:20], model=(model or "unknown")[:120],
                           input_tokens=input_tokens or 0, output_tokens=output_tokens or 0,
                           cost_usd=cost_usd, ok=ok, error=(error or None) and error[:200]))
            db.commit()
    return record


def colombo_midnights(now: datetime) -> tuple[datetime, datetime]:
    """(start of today, start of this month) in Sri Lanka, as naive UTC like the stored times."""
    local = now + COLOMBO
    day = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return day - COLOMBO, day.replace(day=1) - COLOMBO


def _totals(db: Session, since: datetime) -> dict:
    row = db.execute(select(
        func.count(AiUsage.id),
        func.coalesce(func.sum(AiUsage.input_tokens), 0),
        func.coalesce(func.sum(AiUsage.output_tokens), 0),
        func.coalesce(func.sum(AiUsage.cost_usd), 0.0),
        func.count(AiUsage.cost_usd),
        func.coalesce(func.sum(case((AiUsage.ok.is_(False), 1), else_=0)), 0),
    ).where(AiUsage.created_at >= since)).one()
    calls, tin, tout, cost, priced, failed = row
    return {"calls": int(calls), "failed": int(failed), "input_tokens": int(tin), "output_tokens": int(tout),
            "tokens": int(tin) + int(tout), "cost_usd": round(float(cost), 4), "priced_calls": int(priced)}


def summary(db: Session, now: datetime | None = None) -> dict:
    now = now or utcnow()
    today0, month0 = colombo_midnights(now)
    by_purpose = {p: {"purpose": p, "calls": 0, "tokens": 0, "failed": 0} for p in PURPOSES}
    for purpose, calls, tokens, failed in db.execute(
            select(AiUsage.purpose, func.count(AiUsage.id),
                   func.coalesce(func.sum(AiUsage.input_tokens + AiUsage.output_tokens), 0),
                   func.coalesce(func.sum(case((AiUsage.ok.is_(False), 1), else_=0)), 0))
            .where(AiUsage.created_at >= month0).group_by(AiUsage.purpose)):
        row = by_purpose.setdefault(purpose, {"purpose": purpose, "calls": 0, "tokens": 0, "failed": 0})
        row.update(calls=int(calls), tokens=int(tokens), failed=int(failed))
    models = [{"model": m, "calls": int(n), "tokens": int(t)} for m, n, t in db.execute(
        select(AiUsage.model, func.count(AiUsage.id),
               func.coalesce(func.sum(AiUsage.input_tokens + AiUsage.output_tokens), 0))
        .where(AiUsage.created_at >= month0).group_by(AiUsage.model)
        .order_by(func.count(AiUsage.id).desc()).limit(TOP_MODELS))]
    last = db.scalar(select(func.max(AiUsage.created_at)))
    return {
        "today": _totals(db, today0),
        "month": _totals(db, month0),
        "by_purpose": sorted((r for r in by_purpose.values() if r["calls"]), key=lambda r: -r["calls"]),
        "top_models": models,
        "last_call_at": f"{last.isoformat()}Z" if last else None,
    }


def failed_since(db: Session, since: datetime) -> tuple[int, datetime | None]:
    """Failed AI calls since `since`, and when the newest one happened."""
    n, newest = db.execute(select(func.count(AiUsage.id), func.max(AiUsage.created_at))
                           .where(AiUsage.created_at >= since, AiUsage.ok.is_(False))).one()
    return int(n), newest
