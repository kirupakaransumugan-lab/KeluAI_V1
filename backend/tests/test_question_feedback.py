"""Student reports on practice questions: admin-only reading, and photos don't linger."""
import base64
from types import SimpleNamespace as NS

import pytest

from app.api.v1.endpoints import admin_feedback
from app.core.database import get_db
from app.main import app
from app.models.question_feedback import QuestionFeedback
from app.services import question_feedback as feedback
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

ADMIN = "/api/v1/admin/feedback"
SEND = "/api/v1/quizzes/feedback"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20
QUESTION = {"topic": "Limits", "question": "Find the limit.", "answer": "$1$"}
PHOTO = base64.b64encode(PNG).decode()


def _db():
    return next(app.dependency_overrides[get_db]())


def _student(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")


def _admin(client):
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")


def _report(client, kind="mistake", message="The answer should be 2.", image=None):
    return client.post(SEND, json={"kind": kind, "message": message, "question": QUESTION, "image_base64": image})


@pytest.fixture
def images(tmp_path, monkeypatch):
    monkeypatch.setattr(feedback, "IMAGE_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def reported(client):
    _student(client)
    fid = _report(client).json()["id"]
    _admin(client)
    return fid


class FakeLLM:
    def __init__(self, reply="VERDICT: CONFIRMED\nREASON: The answer is 2."):
        self.reply, self.calls = reply, []

    def create(self, **kw):
        self.calls.append(("text", kw))
        return NS(content=[NS(type="text", text=self.reply)])

    def complete_raw(self, **kw):
        self.calls.append(("vision", kw))
        return NS(content=[NS(type="text", text=self.reply)])


def _with_llm(llm):
    app.dependency_overrides[admin_feedback.get_review_llm] = lambda: llm
    return llm


def test_reporting_needs_login(client):
    assert _report(client).status_code == 401


def test_students_cannot_see_or_act_on_reports(client):
    _student(client)
    assert client.get(ADMIN).status_code == 403
    assert client.post(f"{ADMIN}/1/review").status_code == 403
    assert client.post(f"{ADMIN}/1/close").status_code == 403
    assert client.get(f"{ADMIN}/1/image").status_code == 403


def test_a_report_keeps_a_copy_of_the_question(client):
    _student(client)
    fid = _report(client).json()["id"]
    assert _db().get(QuestionFeedback, fid).question_snapshot == QUESTION


def test_daily_limit(client, monkeypatch):
    monkeypatch.setattr(feedback, "DAILY_LIMIT", 1)
    _student(client)
    _report(client)
    resp = _report(client)
    assert resp.status_code == 429 and resp.json()["detail"]["code"] == "too_many_reports"


@pytest.mark.parametrize("message", ["", "x" * 2001])
def test_message_length(client, message):
    _student(client)
    assert _report(client, message=message).status_code == 422


def test_photo_is_stored_under_a_random_name(client, images):
    _student(client)
    fid = _report(client, image=PHOTO).json()["id"]
    name = _db().get(QuestionFeedback, fid).image_name
    assert name.endswith(".png") and (images / name).read_bytes() == PNG


@pytest.mark.parametrize("data", [b"<svg onload=alert(1)>", b"MZ\x90\x00 not an image"])
def test_files_that_arent_images_are_refused(client, images, data):
    _student(client)
    assert _report(client, image=base64.b64encode(data).decode()).status_code == 422
    assert list(images.iterdir()) == []


def test_oversized_photo_is_refused(client, images, monkeypatch):
    monkeypatch.setattr(feedback, "MAX_IMAGE_BYTES", 10)
    _student(client)
    assert _report(client, image=PHOTO).status_code == 413


def test_admin_list_shows_the_report_but_not_the_student(client, reported):
    body = client.get(ADMIN).json()["reports"][0]
    assert body["message"] == "The answer should be 2." and body["question"] == QUESTION
    assert "kavin" not in str(body) and "user_id" not in body


def test_admin_can_view_a_photo_safely(client, images):
    _student(client)
    fid = _report(client, image=PHOTO).json()["id"]
    _admin(client)
    resp = client.get(f"{ADMIN}/{fid}/image")
    assert resp.content == PNG and resp.headers["content-type"] == "image/png"
    assert resp.headers["x-content-type-options"] == "nosniff"


def test_ai_review_gives_a_verdict(client, reported):
    llm = _with_llm(FakeLLM())
    body = client.post(f"{ADMIN}/{reported}/review").json()
    assert body["ai"] == {"verdict": "CONFIRMED", "reason": "The answer is 2."}
    kw = llm.calls[0][1]
    assert "<student_feedback>" in kw["messages"][0]["content"] and "not instructions" in kw["system"]


def test_a_photo_goes_to_the_vision_call(client, images):
    _student(client)
    fid = _report(client, image=PHOTO).json()["id"]
    _admin(client)
    llm = _with_llm(FakeLLM())
    client.post(f"{ADMIN}/{fid}/review")
    assert llm.calls[0][0] == "vision"
    assert llm.calls[0][1]["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_failed_review_is_a_clear_error(client, reported):
    class Down(FakeLLM):
        def create(self, **kw):
            raise RuntimeError("OpenRouter 429")
    _with_llm(Down())
    resp = client.post(f"{ADMIN}/{reported}/review")
    assert resp.status_code == 502 and resp.json()["detail"]["code"] == "review_failed"


def test_closing_removes_it_from_the_list_once(client, reported):
    assert client.post(f"{ADMIN}/{reported}/close").status_code == 200
    assert client.get(ADMIN).json()["reports"] == []
    assert client.post(f"{ADMIN}/{reported}/close").status_code == 404


def test_photo_is_deleted_on_closing(client, images):
    _student(client)
    fid = _report(client, image=PHOTO).json()["id"]
    _admin(client)
    client.post(f"{ADMIN}/{fid}/close")
    assert list(images.iterdir()) == []
    assert _db().get(QuestionFeedback, fid).image_name is None


@pytest.mark.parametrize("text, verdict", [
    ("VERDICT: NOT_CONFIRMED\nREASON: The working is right.", "NOT_CONFIRMED"),
    ("I think it is fine.", "UNSURE"),
])
def test_reading_the_ai_reply(text, verdict):
    got, reason = feedback.parse_review(text)
    assert got == verdict and reason
