"""Stored questions, for the 10-question whole-syllabus quiz only. Subject quizzes are written
live and never stored.

Admins fill this from the Quiz Bank page: the AI writes drafts (app/services/quiz_jobs.py), and
only a question a person has published is ever served, so taking this quiz needs no AI at all.

Duplicates: a question whose normalised text is already in the bank (same language) is not
stored twice. Near-copies of real past papers are the quiz generator's job (is_too_close).
"""
from __future__ import annotations

import hashlib
import logging
import random
import re
from dataclasses import asdict

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.quiz_bank import QuizBankQuestion
from app.rag.quiz import QUIZ_SIZE, QuizQuestion
from app.services.topics import by_id, classify

log = logging.getLogger(__name__)
PER_STRAND = QUIZ_SIZE // 2           # 5 Pure and 5 Applied, like the two papers


def text_hash(question: str) -> str:
    """Same question, different spacing/case/punctuation -> same hash."""
    norm = re.sub(r"[\s.,;:]+", " ", question).strip().lower()
    return hashlib.sha256(norm.encode()).hexdigest()


def add_new(db: Session, lang: str, q: QuizQuestion, status: str = "published") -> tuple[int, bool]:
    """Store `q` -> (bank id, True), or (the existing id, False) if the bank already has it."""
    h = text_hash(q.question)
    topic = classify(q.topic)
    row = QuizBankQuestion(lang=lang, slot=q.number, topic=q.topic[:120], topic_id=topic.id if topic else None,
                           question=q.question, answer=q.answer, status=status,
                           steps=[asdict(s) for s in q.steps], modelled_on=q.modelled_on, text_hash=h)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:          # uq_quiz_bank_lang_text: written before
        db.rollback()
        existing = db.scalar(select(QuizBankQuestion.id).where(QuizBankQuestion.lang == lang, QuizBankQuestion.text_hash == h))
        return existing, False
    return row.id, True


def _published(db: Session, lang: str) -> dict[str, list[tuple[int, int]]]:
    """{strand: [(question id, topic id)]} for what students may be served."""
    out: dict[str, list[tuple[int, int]]] = {"pure": [], "applied": []}
    rows = db.execute(select(QuizBankQuestion.id, QuizBankQuestion.topic_id)
                      .where(QuizBankQuestion.lang == lang, QuizBankQuestion.status == "published",
                             QuizBankQuestion.topic_id.is_not(None)))
    for qid, topic_id in rows:
        topic = by_id(topic_id)
        if topic:
            out[topic.strand].append((qid, topic_id))
    return out


def strand_counts(db: Session, lang: str) -> dict[str, int]:
    """How many questions a quiz could use from each strand: at most PER_STRAND."""
    return {strand: min(len(rows), PER_STRAND) for strand, rows in _published(db, lang).items()}


def _pick(pool: list[tuple[int, int]], exclude: set[int], rng: random.Random) -> list[int]:
    """Up to PER_STRAND questions, unseen first, and as many different topics as possible."""
    ordered = sorted(pool, key=lambda row: (row[0] in exclude, rng.random()))
    picked: list[int] = []
    topics: set[int] = set()
    for qid, topic_id in ordered:
        if len(picked) < PER_STRAND and topic_id not in topics:
            picked.append(qid)
            topics.add(topic_id)
    for qid, _ in ordered:
        if len(picked) < PER_STRAND and qid not in picked:
            picked.append(qid)
    return picked


def pick_full_quiz(db: Session, lang: str, exclude: set[int] = frozenset(), rng: random.Random | None = None) -> list[dict]:
    """A random whole-syllabus quiz: up to 5 Pure and 5 Applied, in random order, numbered from 1.
    One strand never stands in for the other, so a short bank gives a shorter quiz."""
    rng = rng or random.Random()
    pools = _published(db, lang)
    ids = _pick(pools["pure"], exclude, rng) + _pick(pools["applied"], exclude, rng)
    rng.shuffle(ids)
    rows = {r.id: r for r in db.scalars(select(QuizBankQuestion).where(QuizBankQuestion.id.in_(ids)))}
    return [{"bank_id": qid, "number": n, "topic": rows[qid].topic, "question": rows[qid].question,
             "answer": rows[qid].answer, "modelled_on": rows[qid].modelled_on, "steps": rows[qid].steps}
            for n, qid in enumerate(ids, start=1)]
