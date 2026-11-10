"""Admin > Knowledge Base and Admin > Content, against an in-memory Qdrant and the fake embedder."""
import pytest

from app.api.v1.endpoints import admin_library
from app.core.database import get_db
from app.main import app
from app.rag.embeddings import FakeEmbedder
from app.rag.vector_store import VectorStore
from app.services import knowledge_base as kb
from tests.test_admin_roles import login, promote_in_db
from tests.test_auth_login import register

KB = "/api/v1/admin/knowledge-base"


@pytest.fixture
def library(client, tmp_path, monkeypatch):
    embedder = FakeEmbedder(dim=64)
    store = VectorStore.from_url(":memory:", None, "test_kb", embedder.dim)
    store.ensure_collection()
    monkeypatch.setattr(kb, "UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(kb, "_jobs", {})
    app.dependency_overrides[admin_library.get_kb_store] = lambda: (lambda: store)
    app.dependency_overrides[admin_library.get_kb_embedder] = lambda: (lambda: embedder)
    app.dependency_overrides[admin_library.get_session_factory] = lambda: (lambda: next(app.dependency_overrides[get_db]()))
    register(client, "boss@example.com")
    promote_in_db("boss@example.com")
    login(client, "boss@example.com")
    return store


def _upload(client, name, body, lang="en"):
    return client.post(f"{KB}/upload?filename={name}&lang={lang}", content=body,
                       headers={"Content-Type": "application/octet-stream"})


def test_students_cannot_use_it(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    assert client.get(KB).status_code == 403
    assert _upload(client, "notes.txt", b"x").status_code == 403
    assert client.get("/api/v1/admin/content").status_code == 403


def test_a_text_document_is_indexed_listed_and_removed(client, library):
    text = ("Differentiation from first principles. " * 40 + "\n\n") * 4
    r = _upload(client, "Calculus notes.txt", text.encode())
    assert r.status_code == 202
    data = client.get(KB).json()
    [job] = data["jobs"]
    assert job["status"] == "done" and job["chunk_count"] > 0, job
    [doc] = data["documents"]
    assert doc["title"] == "Calculus notes" and doc["upload_type"] == "syllabus" and doc["chunk_count"] == job["chunk_count"]
    assert data["totals"]["documents"] == 1 and data["totals"]["by_language"]["en"] == 1

    assert client.delete(f"{KB}/{doc['upload_id']}").status_code == 204
    assert client.get(KB).json()["documents"] == []


def test_bad_files_are_refused_with_a_reason(client, library):
    assert _upload(client, "paper.pdf", b"%PDF-1.4 x").json()["detail"]["code"] == "bad_filename"
    assert _upload(client, "2019_combinedmaths_full_EM.pdf", b"hello").json()["detail"]["code"] == "not_a_pdf"
    assert _upload(client, "photo.png", b"\x89PNG").json()["detail"]["code"] == "bad_type"
    assert _upload(client, "empty.txt", b"").json()["detail"]["code"] == "empty_file"
    assert client.get(KB).json()["jobs"] == []


def test_retag_runs_as_a_job(client, library):
    assert client.post(f"{KB}/retag").status_code == 202
    [job] = client.get(KB).json()["jobs"]
    assert job["kind"] == "retag" and job["status"] == "done"


def test_content_lists_every_topic_with_gaps(client, library):
    data = client.get("/api/v1/admin/content").json()
    from app.services.topics import TOPICS

    assert len(data["topics"]) == len(TOPICS)
    first = data["topics"][0]
    assert {"kb_chunks", "bank", "practice_answers", "score", "flags"} <= first.keys()
    assert "few_examples" in first["flags"] and "bank_gap" in first["flags"]      # an empty database
    assert data["totals"]["few_examples"] == len(TOPICS)
