"""Admin > Content: syllabus coverage, one row per topic in app/services/topics.py.

For each topic: how many past-paper chunks are tagged with it in Qdrant (the examples the AI
models questions on, refreshed by "Update topic tags" on Admin > Knowledge Base), how many
published quiz-bank questions it has per medium, and how students do on it in practice. Gaps
show where content is thin. Scores use the same step score as the student progress pages.
"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.progress import PracticeAnswer
from app.models.quiz_bank import QuizBankQuestion
from app.models.topic import SyllabusTopic
from app.services.topics import TOPICS, classify

FEW_EXAMPLES = 3            # fewer tagged chunks than this -> "few examples"


def _pct(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def coverage(db: Session) -> dict:
    chunks = {t.id: t.chunk_count for t in db.scalars(select(SyllabusTopic))}
    bank: dict[int, dict[str, int]] = defaultdict(lambda: {"en": 0, "ta": 0})
    for topic_id, lang, n in db.execute(
            select(QuizBankQuestion.topic_id, QuizBankQuestion.lang, func.count())
            .where(QuizBankQuestion.status == "published", QuizBankQuestion.topic_id.is_not(None))
            .group_by(QuizBankQuestion.topic_id, QuizBankQuestion.lang)):
        bank[topic_id][lang] = n

    # Practice answers store the AI's own topic wording, so they are matched onto the list here.
    practice: dict[str, dict] = defaultdict(lambda: {"answers": 0, "right": 0, "total": 0, "students": set()})
    unmatched = 0
    for topic, user_id, right, total in db.execute(
            select(PracticeAnswer.topic, PracticeAnswer.user_id, PracticeAnswer.steps_right, PracticeAnswer.steps_total)):
        t = classify(topic)
        if t is None:
            unmatched += 1
            continue
        p = practice[t.key]
        p["answers"] += 1
        p["right"] += right
        p["total"] += total
        p["students"].add(user_id)

    topics = []
    for t in TOPICS:
        p = practice[t.key]
        n_chunks = chunks.get(t.id, 0)
        b = bank[t.id]
        flags = []
        if n_chunks < FEW_EXAMPLES:
            flags.append("few_examples")
        if not b["en"] or not b["ta"]:
            flags.append("bank_gap")
        topics.append({
            "id": t.id, "key": t.key, "strand": t.strand, "name_en": t.en, "name_ta": t.ta,
            "kb_chunks": n_chunks, "bank": dict(b),
            "practice_answers": p["answers"], "students": len(p["students"]), "score": _pct(p["right"], p["total"]),
            "flags": flags,
        })
    return {
        "topics": topics,
        "totals": {
            "topics": len(topics),
            "few_examples": sum("few_examples" in t["flags"] for t in topics),
            "bank_gaps": sum("bank_gap" in t["flags"] for t in topics),
            "practice_answers": sum(t["practice_answers"] for t in topics),
            "unmatched_answers": unmatched,
        },
        "few_examples": FEW_EXAMPLES,
    }
