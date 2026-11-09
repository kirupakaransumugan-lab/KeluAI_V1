"""A student's progress report, built only from their saved practice answers.

Definitions the page relies on:
  mastery of a topic   steps right / steps answered in that topic
  average mastery      mean of the topics tried, so one heavily practised topic can't hide the rest
  first-try accuracy   questions with every step right / questions answered
  a day counts         the student submitted a set that day, in Sri Lanka time

Anything with no answers behind it is None, never 0: "not tried" is not the same as "scored 0".
Answers are counted in Python: a student has hundreds of rows, not millions.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.progress import PracticeAnswer
from app.models.user import User
from app.services.topics import TOPICS, classify

COLOMBO = timedelta(hours=5, minutes=30)     # Sri Lanka has no daylight saving
WEEKS = 5
GRID_DAYS = 30                               # the daily-goal grid when the range is "all"
RECENT_SETS = 5
TOPIC_MAX = 120


@dataclass(frozen=True)
class NewAnswer:
    slot: int
    topic: str
    steps_total: int
    steps_right: int


def record_set(db: Session, user_id: int, set_id: int, kind: str, lang: str, answers: Iterable[NewAnswer]) -> bool:
    """Save a submitted set. False if it was saved before: retries are safe, and the unique
    constraint (not a prior SELECT) decides, so two simultaneous requests can't both write."""
    now = utcnow()
    db.add_all(PracticeAnswer(user_id=user_id, set_id=set_id, kind=kind, lang=lang, slot=a.slot,
                              topic=a.topic[:TOPIC_MAX], steps_total=a.steps_total, steps_right=a.steps_right,
                              answered_at=now) for a in answers)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    return True


def local_day(at: datetime) -> date:
    return (at + COLOMBO).date()


def _pct(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def _is_perfect(a: PracticeAnswer) -> bool:
    return a.steps_right == a.steps_total


def _score(rows: list[PracticeAnswer]) -> int | None:
    return _pct(sum(a.steps_right for a in rows), sum(a.steps_total for a in rows))


def _accuracy(rows: list[PracticeAnswer]) -> int | None:
    return _pct(sum(map(_is_perfect, rows)), len(rows))


def _by_topic(rows: list[PracticeAnswer]) -> dict[str, list[PracticeAnswer]]:
    grouped: dict[str, list[PracticeAnswer]] = defaultdict(list)
    for a in rows:
        topic = classify(a.topic)
        if topic:
            grouped[topic.key].append(a)
    return grouped


def _mastery(rows: list[PracticeAnswer]) -> int | None:
    scores = [_score(answers) for answers in _by_topic(rows).values()]
    return round(sum(scores) / len(scores)) if scores else None


def _streaks(days: set[date], today: date) -> tuple[int, int]:
    """(current, best). Today not done yet doesn't break a streak: it can still be kept."""
    current = 0
    day = today if today in days else today - timedelta(days=1)
    while day in days:
        current += 1
        day -= timedelta(days=1)
    best = run = 0
    previous = None
    for day in sorted(days):
        run = run + 1 if previous and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return current, best


def _weekly(rows: list[PracticeAnswer], today: date) -> list[dict]:
    this_monday = today - timedelta(days=today.weekday())
    weeks = []
    for back in range(WEEKS - 1, -1, -1):
        monday = this_monday - timedelta(weeks=back)
        inside = [a for a in rows if monday <= local_day(a.answered_at) < monday + timedelta(days=7)]
        weeks.append({"start": monday.isoformat(), "questions": len(inside), "score": _score(inside),
                      "accuracy": _accuracy(inside), "active_days": len({local_day(a.answered_at) for a in inside})})
    return weeks


def _daily(days: set[date], today: date, joined: date, length: int) -> list[dict]:
    out = []
    for back in range(length - 1, -1, -1):
        day = today - timedelta(days=back)
        state = ("done" if day in days else "today" if day == today
                 else "before" if day < joined else "missed")
        out.append({"date": day.isoformat(), "state": state})
    return out


def _topics(rows: list[PracticeAnswer]) -> list[dict]:
    grouped = _by_topic(rows)
    out = []
    for topic in TOPICS:
        answers = grouped.get(topic.key, [])
        out.append({
            "key": topic.key, "strand": topic.strand, "name": {"en": topic.en, "ta": topic.ta},
            "pct": _score(answers), "questions": len(answers),
            "steps_right": sum(a.steps_right for a in answers), "steps_total": sum(a.steps_total for a in answers),
            "last_at": f"{max(a.answered_at for a in answers).isoformat()}Z" if answers else None,
        })
    return sorted(out, key=lambda t: (t["pct"] is None, t["pct"] or 0, t["name"]["en"]))


def _subject_attempts(rows: list[PracticeAnswer]) -> dict[str, list[dict]]:
    """{topic key: its quizzes, newest first}. Only a quiz on that one subject counts as one of
    its attempts: a question in a whole-syllabus quiz adds to the score, not to this history."""
    sets: dict[int, list[PracticeAnswer]] = defaultdict(list)
    for a in rows:
        sets[a.set_id].append(a)
    out: dict[str, list[dict]] = defaultdict(list)
    for set_id, answers in sets.items():
        topics = {classify(a.topic) for a in answers}
        if len(topics) == 1 and None not in topics:
            out[topics.pop().key].append({
                "set_id": set_id, "at": f"{answers[0].answered_at.isoformat()}Z",
                "perfect": sum(map(_is_perfect, answers)), "questions": len(answers), "pct": _score(answers),
            })
    for attempts in out.values():
        attempts.sort(key=lambda a: a["at"], reverse=True)
    return out


def subject_scores(db: Session, user_id: int) -> list[dict]:
    """Every subject with the student's score and quiz history, for choosing the next quiz."""
    rows = list(db.scalars(select(PracticeAnswer).where(PracticeAnswer.user_id == user_id)))
    attempts = _subject_attempts(rows)
    return [{**t, "quizzes": len(attempts[t["key"]]),
             "attempts": attempts[t["key"]][:RECENT_SETS]} for t in _topics(rows)]


def _recent(rows: list[PracticeAnswer]) -> list[dict]:
    sets: dict[int, list[PracticeAnswer]] = defaultdict(list)
    for a in rows:
        sets[a.set_id].append(a)
    latest = sorted(sets.values(), key=lambda s: s[0].answered_at, reverse=True)[:RECENT_SETS]
    out = []
    for answers in latest:
        topics = [classify(a.topic) for a in answers]
        only = topics[0] if len(set(topics)) == 1 else None
        out.append({
            "set_id": answers[0].set_id, "kind": answers[0].kind,
            "topic": {"en": only.en, "ta": only.ta} if only else None,      # None: a mix of topics
            "perfect": sum(map(_is_perfect, answers)), "questions": len(answers),
            "at": f"{answers[0].answered_at.isoformat()}Z",
        })
    return out


def build_report(db: Session, user: User, days: int | None, now: datetime | None = None) -> dict:
    """`days`: the range the headline figures and topics cover, or None for all time."""
    rows = list(db.scalars(select(PracticeAnswer).where(PracticeAnswer.user_id == user.id)
                           .order_by(PracticeAnswer.answered_at)))
    today = local_day(now or utcnow())
    if days:
        first = today - timedelta(days=days - 1)
        in_range = [a for a in rows if local_day(a.answered_at) >= first]
        before = [a for a in rows if first - timedelta(days=days) <= local_day(a.answered_at) < first]
    else:
        in_range, before = rows, []

    mastery, previous = _mastery(in_range), _mastery(before)
    all_days = {local_day(a.answered_at) for a in rows}
    current, best = _streaks(all_days, today)
    topics = _topics(in_range)
    covered = sum(t["pct"] is not None for t in topics)
    return {
        "days": days,
        "has_answers": bool(rows),
        "mastery": {"value": mastery,
                    "change": mastery - previous if mastery is not None and previous is not None else None},
        "topics_covered": {"covered": covered, "total": len(TOPICS)},
        "accuracy": {"value": _accuracy(in_range), "questions": len(in_range)},
        "streak": {"current": current, "best": best},
        "weekly": _weekly(rows, today),
        "daily": _daily(all_days, today, local_day(user.created_at), days or GRID_DAYS),
        "topics": topics,
        "recent": _recent(rows),
    }


# ---------- Dashboard home cards ----------
# One small payload for the four home cards, so the home page makes one request.

PLAN_SIZE = 3
NEEDS_WORK_BELOW = 70        # a tried topic under this % is listed under "Needs work"
NEEDS_WORK_SIZE = 3
RECENT_ON_HOME = 3


def _study_plan(topics: list[dict]) -> list[dict]:
    """Up to PLAN_SIZE topics to study next, each as {**topic, "reason": "weak" | "new"}.

    `topics` is the output of _topics(): every syllabus topic, weakest tried first, then the
    untried ones (pct None) in name order.
    """
    # TODO(human): choose the topics for the study plan.
    return []


def _this_week(rows: list[PracticeAnswer], days: set[date], today: date, joined: date) -> dict:
    week = _weekly(rows, today)[-1]
    monday = today - timedelta(days=today.weekday())
    grid = []
    for i in range(7):
        day = monday + timedelta(days=i)
        state = ("done" if day in days else "today" if day == today else "future" if day > today
                 else "before" if day < joined else "missed")
        grid.append({"date": day.isoformat(), "state": state})
    return {**week, "streak": _streaks(days, today)[0], "days": grid}


def build_dashboard(db: Session, user: User, now: datetime | None = None) -> dict:
    rows = list(db.scalars(select(PracticeAnswer).where(PracticeAnswer.user_id == user.id)
                           .order_by(PracticeAnswer.answered_at)))
    today = local_day(now or utcnow())
    topics = _topics(rows)
    days = {local_day(a.answered_at) for a in rows}
    return {
        "has_answers": bool(rows),
        "plan": _study_plan(topics) if rows else [],
        "needs_work": [t for t in topics if t["pct"] is not None and t["pct"] < NEEDS_WORK_BELOW][:NEEDS_WORK_SIZE],
        "week": _this_week(rows, days, today, local_day(user.created_at)),
        "recent": _recent(rows)[:RECENT_ON_HOME],
    }
