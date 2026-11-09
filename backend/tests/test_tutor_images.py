"""Images attached to a tutor message: validated, sent once to the vision model, never trusted blindly."""
import base64
import json
from types import SimpleNamespace as NS

import pytest

from app.api.v1.endpoints import tutor
from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import Role
from app.rag.agent.tutor_agent import AgentResult, TutorAgent
from app.rag.images import MAX_BYTES, BadImage, parse_data_url
from app.rag.types import AccessScope, TutorMode
from tests.test_openrouter import _llm, _msg, _retriever

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64


def url(raw: bytes, media: str = "image/jpeg") -> str:
    return f"data:{media};base64,{base64.b64encode(raw).decode()}"


# ---------- validation ----------

@pytest.mark.parametrize("raw,media", [(JPEG, "image/jpeg"), (PNG, "image/png"), (WEBP, "image/webp")])
def test_real_images_are_accepted(raw, media):
    img = parse_data_url(url(raw, media))
    assert img.media_type == media and base64.b64decode(img.data) == raw


@pytest.mark.parametrize("bad", [
    url(PNG, "image/jpeg"),                       # says JPEG, is PNG
    url(b"<svg onload=alert(1)>", "image/png"),   # not an image at all
    "data:image/svg+xml;base64,PHN2Zz4=",         # SVG can carry script: not accepted
    "data:image/jpeg;base64,***",                 # not base64
    "https://example.com/x.jpg",                  # a URL, not data
])
def test_anything_else_is_rejected(bad):
    with pytest.raises(BadImage) as e:
        parse_data_url(bad)
    assert e.value.code == "bad_image"


def test_oversized_images_are_rejected():
    with pytest.raises(BadImage) as e:
        parse_data_url(url(JPEG + b"\x00" * (MAX_BYTES + 1)))
    assert e.value.code == "image_too_large"


# ---------- endpoint ----------

class RecordingAgent:
    def __init__(self):
        self.calls = []

    def reply(self, **kw):
        self.calls.append(kw)
        return AgentResult("Your sketch shows a parabola.", [], "vision-model", 10, 0)


@pytest.fixture
def agent(client):
    rec = RecordingAgent()
    app.dependency_overrides[get_current_user] = lambda: NS(id=5, role=Role.student)
    app.dependency_overrides[tutor.get_agent] = lambda: rec
    yield rec


def test_chat_passes_a_valid_image_to_the_agent(client, agent):
    resp = client.post("/api/v1/tutor/chat", json={"history": [{"role": "user", "content": "Is this right?"}],
                                                   "image": url(JPEG)})
    assert resp.status_code == 200
    assert agent.calls[0]["image"].media_type == "image/jpeg"


def test_chat_without_an_image_sends_none(client, agent):
    client.post("/api/v1/tutor/chat", json={"history": [{"role": "user", "content": "hi"}]})
    assert agent.calls[0]["image"] is None


def test_chat_rejects_a_bad_image_before_calling_the_model(client, agent):
    resp = client.post("/api/v1/tutor/chat", json={"history": [{"role": "user", "content": "x"}],
                                                   "image": url(b"not an image")})
    assert resp.status_code == 400 and resp.json()["detail"]["code"] == "bad_image"
    assert agent.calls == []


# ---------- agent + OpenRouter ----------

def test_image_goes_to_the_vision_model_as_an_image_part():
    requests: list[dict] = []
    llm = _llm([_msg("Your graph shows y = x².")], requests)
    agent = TutorAgent(llm, _retriever(), model="text-model", vision_model="vision-model", search_first=True)

    res = agent.reply(scope=AccessScope(1), mode=TutorMode.PRACTICE, language="en",
                      history=[{"role": "user", "content": "Check my sketch"}], image=parse_data_url(url(PNG, "image/png")))

    body = requests[0]
    assert body["model"] == "vision-model" and res.model_name == "vision-model"
    last = body["messages"][-1]
    assert last["role"] == "user" and isinstance(last["content"], list)
    kinds = [p["type"] for p in last["content"]]
    assert kinds == ["text", "image_url"]
    assert last["content"][0]["text"].startswith("Check my sketch")        # search results still appended
    assert last["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert "attached an image" in body["messages"][0]["content"]          # the image note is in the system prompt


def test_without_an_image_the_text_model_answers():
    requests: list[dict] = []
    llm = _llm([_msg("Fine.")], requests)
    TutorAgent(llm, _retriever(), model="text-model", vision_model="vision-model").reply(
        scope=AccessScope(1), mode=TutorMode.PRACTICE, language="en", history=[{"role": "user", "content": "hi"}])
    assert requests[0]["model"] == "text-model"
    assert json.dumps(requests[0]).count("image_url") == 0
