"""Admin Overview: AI usage is recorded by the OpenRouter client, and Needs attention lists what
an admin should act on."""
from datetime import datetime, timedelta

import httpx
from app.core.clock import utcnow
import pytest

from app.core.database import get_db
from app.main import app
from app.models import AiUsage, QuestionFeedback, QuizBankQuestion, QuizGenerationJob, Subscription, SubscriptionStatus
from app.rag.agent import openrouter_llm
from app.rag.agent.openrouter_llm import OpenRouterLLM
from app.services import ai_usage, knowledge_base
from tests.test_admin_billing import _pay, _setup

URL = "/api/v1/admin/overview?days=30"


def _db():
    return next(app.dependency_overrides[get_db]())


@pytest.fixture
def recorder(client):
    """Record AI usage into the test database (the app registers the real one at start-up)."""
    previous = openrouter_llm._recorder
    openrouter_llm.set_usage_recorder(ai_usage.make_recorder(_db))
    yield
    openrouter_llm.set_usage_recorder(previous)


def _llm(purpose, status=200, body=None):
    body = body or {"model": "test/model-a", "choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 120, "completion_tokens": 30, "cost": 0.0021}}
    llm = OpenRouterLLM("test-key", purpose=purpose)
    llm._http = httpx.Client(base_url="https://x",
                             transport=httpx.MockTransport(lambda req: httpx.Response(status, json=body)))
    return llm


def test_every_ai_call_is_recorded_with_its_purpose(client, recorder):
    _setup(client)
    _llm("tutor").create(model="test/model-a", max_tokens=50, system="s", messages=[{"role": "user", "content": "x"}])
    _llm("quiz").create(model="test/model-a", max_tokens=50, system="s", messages=[{"role": "user", "content": "x"}])
    with pytest.raises(RuntimeError):
        _llm("ocr", status=402, body={"error": {"message": "Insufficient credits"}}).create(
            model="test/model-b", max_tokens=50, system="s", messages=[{"role": "user", "content": "x"}])

    rows = _db().query(AiUsage).order_by(AiUsage.id).all()
    assert [(r.purpose, r.ok) for r in rows] == [("tutor", True), ("quiz", True), ("ocr", False)]
    assert rows[0].input_tokens == 120 and rows[0].output_tokens == 30 and rows[0].cost_usd == pytest.approx(0.0021)
    assert "Insufficient credits" in rows[2].error

    usage = client.get(URL).json()["ai_usage"]
    assert usage["today"]["calls"] == 3 and usage["today"]["failed"] == 1
    assert usage["today"]["tokens"] == 300 and usage["today"]["priced_calls"] == 2
    assert usage["month"]["cost_usd"] == pytest.approx(0.0042)
    assert {p["purpose"] for p in usage["by_purpose"]} == {"tutor", "quiz", "ocr"}
    assert usage["top_models"][0] == {"model": "test/model-a", "calls": 2, "tokens": 300}

    [failure] = [i for i in client.get(URL).json()["attention"] if i["kind"] == "ai_failures"]
    assert failure["count"] == 1 and "Insufficient credits" in failure["detail"]


def test_a_broken_recorder_never_breaks_the_ai_call(client):
    previous = openrouter_llm._recorder
    openrouter_llm.set_usage_recorder(lambda *a: 1 / 0)
    try:
        resp = _llm("tutor").create(model="m", max_tokens=5, system="s", messages=[{"role": "user", "content": "x"}])
        assert resp.content[0].text == "hi"
    finally:
        openrouter_llm.set_usage_recorder(previous)


def test_nothing_needs_attention_on_a_quiet_day(client, monkeypatch):
    monkeypatch.setattr(knowledge_base, "_jobs", {})
    _setup(client)
    data = client.get(URL).json()
    assert data["attention"] == []
    assert data["ai_usage"]["today"]["calls"] == 0 and data["ai_usage"]["last_call_at"] is None


def test_attention_lists_reports_drafts_stopped_jobs_and_plans_ending(client, monkeypatch):
    monkeypatch.setattr(knowledge_base, "_jobs", {})
    kavin = _setup(client)
    db = _db()
    db.add(QuestionFeedback(user_id=kavin, kind="mistake", message="Q2 answer is wrong", question_snapshot={}))
    db.add(QuizBankQuestion(lang="en", slot=1, topic="Limits", question="q", answer="a", steps=[], modelled_on={},
                            text_hash="h1", status="draft"))
    db.add(QuizGenerationJob(lang="en", status="stopped", requested=5, added=1, failed=6, created_by=kavin,
                             started_at=datetime(2026, 11, 1), finished_at=datetime(2026, 11, 1, 0, 5)))
    db.commit()
    assert _pay(client, kavin, plan="monthly", amount=1500).status_code == 201
    sub = db.query(Subscription).filter(Subscription.plan == "monthly").one()
    sub.ends_at = utcnow() + timedelta(days=3)
    db.commit()

    kinds = {i["kind"]: i for i in client.get(URL).json()["attention"]}
    assert set(kinds) == {"feedback", "drafts", "quiz_job", "plans_ending"}
    assert kinds["feedback"]["link"] == "/admin/feedback" and kinds["feedback"]["count"] == 1
    assert kinds["drafts"]["title"] == "1 quiz draft waiting for review"
    assert "6 failed" in kinds["quiz_job"]["detail"]
    assert "Kavin Raj" in kinds["plans_ending"]["detail"]

    # Renewing the plan takes it off the list.
    assert _pay(client, kavin, plan="monthly", amount=1500).status_code == 201
    assert "plans_ending" not in {i["kind"] for i in client.get(URL).json()["attention"]}


def test_a_failed_knowledge_base_upload_is_listed(client, monkeypatch):
    monkeypatch.setattr(knowledge_base, "_jobs", {})
    _setup(client)
    job = knowledge_base._new_job("upload", "2019_combinedmaths_full_EM.pdf")
    knowledge_base._set(job["id"], status="failed", message="No text could be read", finished_at="2026-11-10T08:00:00Z")
    [item] = client.get(URL).json()["attention"]
    assert item["kind"] == "kb_upload" and "No text could be read" in item["detail"]
    assert item["link"] == "/admin/knowledge-base"


def test_colombo_day_starts_at_local_midnight():
    # 19:00 UTC on 9 Nov is 00:30 on 10 Nov in Sri Lanka.
    today0, month0 = ai_usage.colombo_midnights(datetime(2026, 11, 9, 19, 0))
    assert today0 == datetime(2026, 11, 9, 18, 30) and month0 == datetime(2026, 10, 31, 18, 30)
