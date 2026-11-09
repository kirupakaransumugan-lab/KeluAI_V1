"""Who may take the 10-question whole-syllabus quiz: students in their exam year.

Exam year: the student's A/L year is this calendar year (or past: a repeat candidate), or the
exam is at most EXAM_WINDOW_MONTHS away. Only a year is stored per student, so the exam date
comes from EXAM_MONTH / EXAM_DAY, the 2026 start date (10 August to 5 September). Later years
are assumed to match: update these if the exam moves.

The rule is enforced here, on the server: the page only hides what this would refuse.
"""
from __future__ import annotations

from datetime import date

from app.core.clock import utcnow
from app.models.user import User
from app.services.progress import local_day

EXAM_MONTH, EXAM_DAY = 8, 10
EXAM_WINDOW_MONTHS = 6


def is_exam_year(al_exam_year: int | None, today: date, exam_month: int = EXAM_MONTH) -> bool:
    if al_exam_year is None:
        return False
    # Months since year 0, so a window can run back across New Year.
    opens = al_exam_year * 12 + (exam_month - 1) - EXAM_WINDOW_MONTHS
    return al_exam_year <= today.year or today >= date(opens // 12, opens % 12 + 1, EXAM_DAY)


def can_take_full_quiz(user: User) -> bool:
    profile = user.profile
    return is_exam_year(profile.al_exam_year if profile else None, local_day(utcnow()))
