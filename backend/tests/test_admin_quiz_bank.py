"""Admin question review: AI drafts never reach students until a person publishes them."""
import time
from collections import Counter
from datetime import timedelta

import pytest

from app.api.v1.endpoints import admin_quiz
from app.core.clock import utcnow
from app.core.database import get_db
from app.main import app
from app.models import QuizBankQuestion
from app.models.quiz_job import QuizGenerationJob
from app.rag.quiz import QuizIncomplete, QuizQuestion, QuizStep, StepOption
from app.services import quiz_bank, quiz_jobs
from app.services.topics import TOPICS, by_key
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

URL = "/api/v1/admin/quiz-bank"
STEPS = [QuizStep(f"step {n}", [StepOption("$r$", "ok", True), StepOption("$w$", "slip", False)]) for n in (1, 2, 3)]


def _db():
    return next(app.dependency_overrides[get_db]())


def _admin(client):
    register(client, "boss@example.com")
    admin_id = promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    return admin_id


def _q(topic, text):
    return QuizQuestion(1, topic, text, "$1$", {}, STEPS)


def _draft(db, topic="Limits", text="A limit question", lang="en"):
    return quiz_bank.add_new(db, lang, _q(topic, text), status="draft")[0]


@pytest.fixture
def runner(client):
    started = []
    app.dependency_overrides[admin_quiz.get_job_runner] = lambda: lambda *args: started.append(args)
    return started


def test_students_cannot_use_any_of_it(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(URL).status_code == 403
    assert client.post(f"{URL}/generate", json={}).status_code == 403
    assert client.post(f"{URL}/drafts/1/publish").status_code == 403
    assert client.delete(f"{URL}/drafts/1").status_code == 403


def test_drafts_are_never_served_to_students(client):
    db = _db()
    draft = _draft(db)
    assert quiz_bank.pick_full_quiz(db, "en") == []
    assert quiz_bank.strand_counts(db, "en") == {"pure": 0, "applied": 0}
    db.get(QuizBankQuestion, draft).status = "published"
    db.commit()
    assert [q["bank_id"] for q in quiz_bank.pick_full_quiz(db, "en")] == [draft]


def test_publishing_makes_a_draft_servable(client):
    _admin(client)
    db = _db()
    draft = _draft(db)
    assert client.post(f"{URL}/drafts/{draft}/publish").json() == {"id": draft, "status": "published"}
    assert quiz_bank.strand_counts(_db(), "en")["pure"] == 1


def test_rejecting_deletes_the_draft(client):
    _admin(client)
    db = _db()
    draft = _draft(db)
    assert client.delete(f"{URL}/drafts/{draft}").status_code == 204
    assert _db().get(QuizBankQuestion, draft) is None


def test_a_published_question_cannot_be_rejected_here(client):
    _admin(client)
    db = _db()
    qid = quiz_bank.add_new(db, "en", _q("Limits", "Live question"))[0]
    assert client.delete(f"{URL}/drafts/{qid}").status_code == 404
    assert client.post(f"{URL}/drafts/{qid}/publish").status_code == 404
    assert _db().get(QuizBankQuestion, qid) is not None


def test_overview_counts_and_lists_drafts(client):
    _admin(client)
    db = _db()
    quiz_bank.add_new(db, "en", _q("Limits", "Live question"))
    _draft(db)
    _draft(db, topic="Friction", text="Tamil draft", lang="ta")
    body = client.get(URL).json()
    limits = next(t for t in body["topics"] if t["key"] == "limits")
    assert (limits["published"], limits["drafts"]) == (1, 1)
    assert [d["question"] for d in body["drafts"]] == ["A limit question"]
    assert body["drafts"][0]["steps"][0]["options"][0]["correct"] is True
    assert len(body["topics"]) == len(TOPICS) and body["job"] is None and body["blocked"] is None


def test_generate_starts_a_job_in_the_background(client, runner):
    admin_id = _admin(client)
    resp = client.post(f"{URL}/generate", json={"lang": "en"})
    assert resp.status_code == 202 and resp.json()["status"] == "running"
    job_id, topics, lang = runner[0]
    assert len(topics) == 10 and lang == "en"
    assert _db().get(QuizGenerationJob, job_id).created_by == admin_id


def test_only_one_job_runs_at_a_time(client, runner):
    _admin(client)
    client.post(f"{URL}/generate", json={})
    resp = client.post(f"{URL}/generate", json={})
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "job_running"
    assert len(runner) == 1


def _job(db, *, status="finished", added=10, ago=timedelta(0), lang="en"):
    db.add(QuizGenerationJob(lang=lang, status=status, requested=10, added=added, failed=0, started_at=utcnow() - ago))
    db.commit()


def test_one_set_a_day(client, runner):
    _admin(client)
    _job(_db())
    resp = client.post(f"{URL}/generate", json={})
    assert resp.status_code == 409 and resp.json()["detail"]["code"] == "daily_set_done"


def test_a_set_that_wrote_nothing_doesnt_use_up_the_day(client, runner):
    _admin(client)
    _job(_db(), status="failed", added=0)
    assert client.post(f"{URL}/generate", json={}).status_code == 202


def test_yesterdays_set_doesnt_block_today(client, runner):
    _admin(client)
    _job(_db(), ago=timedelta(days=1, hours=1))
    assert client.post(f"{URL}/generate", json={}).status_code == 202


def test_a_dead_job_stops_blocking(client, runner):
    _admin(client)
    db = _db()
    _job(db, status="running", added=0, ago=quiz_jobs.STALE_AFTER + timedelta(minutes=1))
    assert quiz_jobs.blocked_reason(db, "en") is None
    assert db.query(QuizGenerationJob).one().status == "failed"


def test_emptiest_topics_come_first_and_drafts_count(client):
    db = _db()
    quiz_bank.add_new(db, "en", _q("Limits", "Live question"))
    _draft(db, topic="Series", text="A series draft")
    topics = quiz_jobs.emptiest_topics(db, "en")
    assert len(topics) == 10 and not {t.key for t in topics} & {"limits", "series"}
    assert Counter(t.strand for t in topics) == {"pure": 5, "applied": 5}


def _start(db, n):
    return quiz_jobs.start_job(db, "en", None, n).id


def test_run_job_saves_drafts_and_reports_progress(client):
    db = _db()
    job_id = _start(db, 3)
    topics = [by_key("limits"), by_key("series"), by_key("friction")]
    quiz_jobs.run_job(job_id, topics, lambda t: _q(t.en, f"{t.key} question"), _db)
    db = _db()
    job = db.get(QuizGenerationJob, job_id)
    assert (job.status, job.added, job.failed) == ("finished", 3, 0) and job.finished_at
    assert Counter(r.status for r in db.query(QuizBankQuestion)) == {"draft": 3}


def test_run_job_counts_failures_and_duplicates(client):
    db = _db()
    job_id = _start(db, 3)
    _draft(db, text="Already here")

    def write(topic):
        if topic.key == "limits":
            raise QuizIncomplete("no")
        return _q(topic.en, "Already here")

    quiz_jobs.run_job(job_id, [by_key("limits"), by_key("series"), by_key("friction")], write, _db)
    job = _db().get(QuizGenerationJob, job_id)
    assert (job.status, job.added, job.failed) == ("finished", 0, 3)


def test_run_job_stops_when_everything_keeps_failing(client):
    db = _db()
    job_id = _start(db, 10)

    asked = []

    def write(topic):
        asked.append(topic)
        time.sleep(0.1)                     # a real AI call takes seconds, not microseconds
        raise QuizIncomplete("quota")

    quiz_jobs.run_job(job_id, list(TOPICS[:10]), write, _db)
    job = _db().get(QuizGenerationJob, job_id)
    assert job.status == "stopped" and job.failed >= quiz_jobs.STOP_AFTER_FAILURES
    assert len(asked) < 10                  # the rest of the set never spent a request
    assert job.failed == len(asked)         # topics never asked aren't counted as failures
