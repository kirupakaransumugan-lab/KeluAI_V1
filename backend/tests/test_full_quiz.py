"""The stored 10-question quiz: exam-year students only, 5 Pure and 5 Applied, no AI."""
import random
from collections import Counter
from datetime import date

import pytest

from app.api.v1.endpoints import tutor
from app.core.database import get_db
from app.main import app
from app.models import QuizBankQuestion, StudentProfile
from app.rag.quiz import QuizQuestion, QuizStep, StepOption
from app.services import quiz_bank, quiz_plan
from app.services.topics import TOPICS, by_id, classify
from tests.test_admin_roles import login
from tests.test_auth_login import register

THIS_YEAR = date.today().year
URL = "/api/v1/tutor/quiz/set"
STEPS = [QuizStep(f"step {n}", [StepOption("$r$", "ok", True), StepOption("$w$", "slip", False)]) for n in (1, 2, 3)]
PURE = [t for t in TOPICS if t.strand == "pure"]
APPLIED = [t for t in TOPICS if t.strand == "applied"]


def _db():
    return next(app.dependency_overrides[get_db]())


def _student(client, exam_year):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    db = _db()
    db.query(StudentProfile).one().al_exam_year = exam_year
    db.commit()


def _bank(db, topic, text=None, lang="en", status="published"):
    text = text or f"{topic.en} question {random.random()}"
    return quiz_bank.add_new(db, lang, QuizQuestion(1, topic.en, text, "$1$", {}, STEPS), status=status)[0]


def _fill(db, pure=5, applied=5):
    return [_bank(db, t) for t in PURE[:pure]] + [_bank(db, t) for t in APPLIED[:applied]]


def _strands(questions):
    return Counter(classify(q["topic"]).strand for q in questions)


def test_exam_year_rule():
    today = date(2026, 11, 6)
    assert quiz_plan.is_exam_year(2026, today) and quiz_plan.is_exam_year(2025, today)
    assert not quiz_plan.is_exam_year(2028, today)
    assert not quiz_plan.is_exam_year(None, today)


@pytest.mark.parametrize("exam_month, today, expected", [
    (2, date(2026, 8, 9), False),       # exam 10 Feb 2027: the window opens 10 Aug 2026
    (2, date(2026, 8, 10), True),
    (8, date(2026, 11, 6), False),      # exam 10 Aug 2027: 10 Feb 2027
    (8, date(2027, 1, 1), True),        # exam year has begun, whatever the window says
])
def test_six_months_before_the_exam_counts(exam_month, today, expected):
    assert quiz_plan.is_exam_year(2027, today, exam_month) is expected


def test_needs_login(client):
    assert client.post(URL, json={}).status_code == 401


def test_first_years_cannot_take_it(client):
    _student(client, THIS_YEAR + 2)
    _fill(_db())
    resp = client.post(URL, json={})
    assert resp.status_code == 403 and resp.json()["detail"]["code"] == "full_quiz_locked"


def test_no_ai_is_needed(client):
    # The route has no generator dependency, so it can't reach the AI.
    def boom():
        raise AssertionError("the AI was asked for")
    app.dependency_overrides[tutor.get_quiz_generator] = boom
    _student(client, THIS_YEAR)
    _fill(_db())
    assert client.post(URL, json={}).status_code == 200


def test_ten_questions_five_of_each(client):
    _student(client, THIS_YEAR)
    _fill(_db(), pure=7, applied=7)
    questions = client.post(URL, json={}).json()["questions"]
    assert _strands(questions) == {"pure": 5, "applied": 5}
    assert [q["number"] for q in questions] == list(range(1, 11))
    assert len({q["bank_id"] for q in questions}) == 10
    assert questions[0]["steps"][0]["options"][0]["correct"] is True


def test_a_short_strand_makes_a_shorter_quiz_not_a_lopsided_one(client):
    _student(client, THIS_YEAR)
    _fill(_db(), pure=8, applied=3)
    assert _strands(client.post(URL, json={}).json()["questions"]) == {"pure": 5, "applied": 3}


def test_empty_bank_says_so(client):
    _student(client, THIS_YEAR)
    resp = client.post(URL, json={})
    assert resp.status_code == 404 and resp.json()["detail"]["code"] == "no_bank_questions"


def test_drafts_and_other_languages_are_not_served(client):
    _student(client, THIS_YEAR)
    db = _db()
    _bank(db, PURE[0], status="draft")
    _bank(db, PURE[1], lang="ta")
    assert client.post(URL, json={"lang": "en"}).status_code == 404


def test_unseen_questions_come_first_then_seen_ones_repeat(client):
    db = _db()
    seen = [_bank(db, PURE[0], text=f"Seen {n}") for n in range(5)]
    fresh = [_bank(db, PURE[0], text=f"Fresh {n}") for n in range(2)]
    picked = {q["bank_id"] for q in quiz_bank.pick_full_quiz(db, "en", exclude=set(seen), rng=random.Random(1))}
    assert set(fresh) < picked and len(picked) == 5


def test_different_topics_are_preferred(client):
    db = _db()
    for n in range(4):
        _bank(db, PURE[0], text=f"Same topic {n}")
    for t in PURE[1:5]:
        _bank(db, t)
    questions = quiz_bank.pick_full_quiz(db, "en", rng=random.Random(2))
    assert len({q["topic"] for q in questions}) == 5


def test_subjects_tell_the_page_what_it_can_offer(client):
    _student(client, THIS_YEAR)
    _fill(_db(), pure=8, applied=3)
    body = client.get("/api/v1/quizzes/subjects").json()
    assert body["full_quiz"] == {"allowed": True, "pure": 5, "applied": 3}


def test_first_years_are_told_it_is_locked(client):
    _student(client, THIS_YEAR + 2)
    assert client.get("/api/v1/quizzes/subjects").json()["full_quiz"]["allowed"] is False


def test_questions_are_filed_under_their_topic(client):
    db = _db()
    qid = _bank(db, APPLIED[0])
    assert by_id(_db().get(QuizBankQuestion, qid).topic_id).strand == "applied"


def test_same_question_is_stored_once_per_language(client):
    db = _db()
    first = _bank(db, PURE[0], text="Solve $x + 1 = 2$.")
    assert _bank(db, PURE[0], text="solve  $x + 1 = 2$") == first
    assert _bank(db, PURE[0], text="Solve $x + 1 = 2$.", lang="ta") != first
