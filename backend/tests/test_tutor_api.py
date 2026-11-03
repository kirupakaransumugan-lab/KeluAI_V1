"""Tutor endpoints: auth required, scope comes from the session user, not the body."""
from types import SimpleNamespace as NS

import pytest

from app.api.v1.endpoints import tutor
from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import Role
from app.rag.agent.tutor_agent import AgentResult


class RecordingAgent:
    def __init__(self):
        self.calls = []

    def reply(self, **kw):
        self.calls.append(kw)
        return AgentResult("Try the general term [S1].", [{"label": "S1"}], "test-model", 42, 0)


@pytest.fixture
def agent(client):
    rec = RecordingAgent()
    app.dependency_overrides[get_current_user] = lambda: NS(id=77, role=Role.student)
    app.dependency_overrides[tutor.get_agent] = lambda: rec
    yield rec


def test_chat_requires_login(client):
    resp = client.post("/api/v1/tutor/chat", json={"history": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401


def test_chat_uses_session_user_scope(client, agent):
    resp = client.post("/api/v1/tutor/chat", json={
        "history": [{"role": "user", "content": "2019 Q12?"}], "mode": "review", "lang": "ta",
        "user_id": 1,     # ignored: scope never comes from the body
    })
    assert resp.status_code == 200
    assert resp.json()["content"] == "Try the general term [S1]."
    call = agent.calls[0]
    assert (call["scope"].user_id, call["scope"].role) == (77, "student")
    assert (call["mode"].value, call["language"]) == ("review", "ta")


def test_history_must_end_with_user(client, agent):
    resp = client.post("/api/v1/tutor/chat", json={"history": [{"role": "assistant", "content": "x"}]})
    assert resp.status_code == 400 and agent.calls == []


def test_history_is_trimmed_to_last_turns(client, agent):
    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": str(i)} for i in range(31)]
    client.post("/api/v1/tutor/chat", json={"history": history})
    assert len(agent.calls[0]["history"]) == tutor.HISTORY_TURNS
