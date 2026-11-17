"""Free students: 20 tutor messages and 10 practice quizzes a Sri Lanka day. Paid: no limit.
Counted only once the AI has answered; a quiz's five questions count once."""
from datetime import timedelta
from types import SimpleNamespace as NS

import pytest

from app.api.v1.endpoints import tutor
from app.core.clock import utcnow
from app.core.database import get_db
from app.main import app
from app.models import DailyUsage
from app.models.user import Subscription, SubscriptionStatus
from app.repositories import user_repository
from app.rag.quiz import QuizIncomplete, QuizQuestion
from tests.test_admin_roles import login
from tests.test_auth_login import register

CHAT = "/api/v1/tutor/chat"
QUIZ = "/api/v1/tutor/quiz/question"


def _db():
    return next(app.dependency_overrides[get_db]())


class FakeAgent:
    def __init__(self, fail=False):
        self.fail = fail

    def reply(self, **kw):
        if self.fail:
            raise RuntimeError("model down")
        return NS(content="hint", sources=[], tool_calls=[], tokens_used=1, truncated=False,
                  model_name="m", hint_level=0)


class FakeGenerator:
    model = "m"

    def __init__(self, fail=False):
        self.fail = fail

    def generate_for_topic(self, *, slot, **kw):
        if self.fail:
            raise QuizIncomplete("no")
        return QuizQuestion(slot, "Limits", "Q", "A", {}, [])


@pytest.fixture
def student(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    agent, gen = FakeAgent(), FakeGenerator()
    app.dependency_overrides[tutor.get_agent] = lambda: agent
    app.dependency_overrides[tutor.get_quiz_generator] = lambda: gen
    return NS(agent=agent, gen=gen)


def _say(client, text="hi"):
    return client.post(CHAT, json={"history": [{"role": "user", "content": text}]})


def _question(client, quiz_id, slot=1):
    return client.post(QUIZ, json={"slot": slot, "topic": "limits", "quiz_id": quiz_id})


def _make_paid(email):
    db = _db()
    user = user_repository.get_by_email(db, email)
    now = utcnow()
    db.add(Subscription(user_id=user.id, plan="monthly", status=SubscriptionStatus.active,
                        starts_at=now - timedelta(days=1), ends_at=now + timedelta(days=29)))
    db.commit()


def test_free_student_gets_twenty_messages(client, student):
    for _ in range(20):
        assert _say(client).status_code == 200
    resp = _say(client)
    assert resp.status_code == 429
    assert resp.json()["detail"] == {"code": "daily_limit", "kind": "chat", "limit": 20}
    usage = client.get("/api/v1/tutor/usage").json()
    assert usage["chat"] == {"used": 20, "limit": 20} and usage["quiz"]["limit"] == 10


def test_a_failed_reply_does_not_count(client, student):
    student.agent.fail = True
    assert _say(client).status_code == 502
    assert client.get("/api/v1/tutor/usage").json()["chat"]["used"] == 0


def test_five_questions_of_one_quiz_count_once_and_the_eleventh_quiz_is_refused(client, student):
    for quiz in range(10):
        for slot in range(1, 6):
            assert _question(client, quiz, slot).status_code == 200
    assert client.get("/api/v1/tutor/usage").json()["quiz"]["used"] == 10
    resp = _question(client, 99)
    assert resp.status_code == 429 and resp.json()["detail"]["kind"] == "quiz"
    # A quiz already started today can still finish its questions.
    assert _question(client, 9, 5).status_code == 200


def test_a_quiz_whose_questions_all_fail_does_not_count(client, student):
    student.gen.fail = True
    assert _question(client, 1).status_code == 502
    assert client.get("/api/v1/tutor/usage").json()["quiz"]["used"] == 0


def test_paid_students_have_no_limit(client, student):
    _make_paid("kavin@example.com")
    for _ in range(21):
        assert _say(client).status_code == 200
    usage = client.get("/api/v1/tutor/usage").json()
    assert usage["chat"] == {"used": 21, "limit": None}


def test_limits_are_per_day(client, student):
    for _ in range(20):
        _say(client)
    db = _db()
    for row in db.query(DailyUsage).all():          # move today's use to yesterday
        row.day = row.day - timedelta(days=1)
    db.commit()
    assert _say(client).status_code == 200
