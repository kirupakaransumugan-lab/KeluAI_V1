"""Tutor chats on the server: one row per chat, newest edit wins, each student sees only their own."""
from app.core.database import get_db
from app.main import app
from app.models import TutorConversation
from app.schemas.auth import allowed_exam_years

URL = "/api/v1/tutor/conversations"


def _register(client, email="kavin@example.com"):
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Kavin Raj", "email": email, "mobile": "0771234567", "password": "s3cure-pass",
        "medium": "ta", "al_exam_year": allowed_exam_years()[1], "accept_terms": True,
    })
    assert resp.status_code == 201, resp.text


def _chat(updated=2000, saved=False, title="Limits", text="hello"):
    return {"title": title, "saved": saved, "hint_level": 1, "created_ms": 1000, "updated_ms": updated,
            "messages": [{"id": "m1", "role": "user", "content": text, "at": 1000},
                         {"id": "m2", "role": "assistant", "content": "hint", "at": 1001,
                          "sources": [{"label": "S1"}], "hintLevel": 1}]}


def _db():
    return next(app.dependency_overrides[get_db]())


def test_chats_need_login(client):
    assert client.get(URL).status_code == 401
    assert client.put(f"{URL}/abc", json=_chat()).status_code == 401


def test_a_saved_chat_comes_back_as_sent(client):
    _register(client)
    assert client.put(f"{URL}/c-1", json=_chat(saved=True)).status_code == 200
    [chat] = client.get(URL).json()["conversations"]
    assert chat["id"] == "c-1" and chat["saved"] is True and chat["hint_level"] == 1
    assert chat["messages"][1]["sources"] == [{"label": "S1"}]        # extra fields kept


def test_putting_a_chat_again_replaces_it(client):
    _register(client)
    client.put(f"{URL}/c-1", json=_chat(updated=2000, text="old"))
    client.put(f"{URL}/c-1", json=_chat(updated=3000, text="new"))
    assert _db().query(TutorConversation).count() == 1
    assert client.get(URL).json()["conversations"][0]["messages"][0]["content"] == "new"


def test_an_older_copy_does_not_overwrite_a_newer_one(client):
    _register(client)
    client.put(f"{URL}/c-1", json=_chat(updated=5000, text="newer, from the phone"))
    resp = client.put(f"{URL}/c-1", json=_chat(updated=4000, text="older, from the laptop"))
    assert resp.json()["messages"][0]["content"] == "newer, from the phone"       # the browser catches up


def test_students_only_see_and_delete_their_own(client):
    _register(client)
    client.put(f"{URL}/c-1", json=_chat())
    client.post("/api/v1/auth/logout")
    _register(client, email="other@example.com")
    assert client.get(URL).json()["conversations"] == []
    assert client.delete(f"{URL}/c-1").status_code == 204
    assert _db().query(TutorConversation).count() == 1                              # still there


def test_delete_removes_it_and_is_safe_to_repeat(client):
    _register(client)
    client.put(f"{URL}/c-1", json=_chat())
    assert client.delete(f"{URL}/c-1").status_code == 204
    assert client.delete(f"{URL}/c-1").status_code == 204
    assert client.get(URL).json()["conversations"] == []


def test_bad_chats_are_refused(client):
    _register(client)
    bad_role = _chat()
    bad_role["messages"][0]["role"] = "system"
    assert client.put(f"{URL}/c-1", json=bad_role).status_code == 422
    assert client.put(f"{URL}/bad id!", json=_chat()).status_code in (404, 422)


def test_deleting_the_account_deletes_the_chats(client):
    _register(client)
    client.put(f"{URL}/c-1", json=_chat())
    resp = client.request("DELETE", "/api/v1/auth/me",
                          json={"confirm_email": "kavin@example.com", "password": "s3cure-pass"})
    assert resp.status_code == 204
    assert _db().query(TutorConversation).count() == 0
