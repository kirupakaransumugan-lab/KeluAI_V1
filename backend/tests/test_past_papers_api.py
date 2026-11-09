"""Past-paper library: built from the vector store, global library only, login required."""
from types import SimpleNamespace as NS

import pytest

from app.api.v1.endpoints import papers
from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import Role
from app.rag.types import Chunk, UploadRecord
from app.rag.vector_store import VectorStore
from app.services.past_papers import clean_text

SCHEME, PAPER, PRIVATE, NOTES = 902022111, 902024101, 55, 66


def _index(store, upload_id, upload_type, chunks, *, year=2022, visibility="global", user_id=0):
    rec = UploadRecord(upload_id=upload_id, user_id=user_id, upload_type=upload_type, visibility=visibility,
                       language="en", title=f"title {upload_id}", exam_year=year, text="x")
    store.upsert_chunks(rec, chunks, [[1.0, 0.0, 0.0, 0.0]] * len(chunks))


def _login():
    app.dependency_overrides[get_current_user] = lambda: NS(id=77, role=Role.student)


@pytest.fixture
def store(client):
    s = VectorStore.from_url(":memory:", None, "test", 4)
    s.ensure_collection()
    _index(s, SCHEME, "marking_scheme", [
        Chunk(SCHEME, 0, "cover page", page=1),
        Chunk(SCHEME, 1, "Q10 working", page=3, paper="I", paper_part="A", question_number="10"),
        Chunk(SCHEME, 2, "Q2 working", page=2, paper="I", paper_part="A", question_number="2"),
        Chunk(SCHEME, 3, "Q12 applied", page=4, paper="II", paper_part="B", question_number="12"),
    ])
    _index(s, PAPER, "past_paper", [Chunk(PAPER, 0, "newer paper", page=1, paper="I")], year=2024)
    _index(s, PRIVATE, "past_paper", [Chunk(PRIVATE, 0, "my upload")], visibility="private", user_id=77)
    _index(s, NOTES, "notes", [Chunk(NOTES, 0, "library notes")])
    app.dependency_overrides[papers.get_paper_store] = lambda: s
    _login()
    yield s


def test_requires_login(client):
    assert client.get("/api/v1/papers").status_code == 401
    assert client.get(f"/api/v1/papers/{SCHEME}").status_code == 401


def test_lists_global_papers_newest_first(client, store):
    listed = client.get("/api/v1/papers").json()["papers"]
    # The student's own private upload and non-paper documents stay out of the library.
    assert [p["upload_id"] for p in listed] == [PAPER, SCHEME]
    assert "chunks" not in listed[0]       # the list carries no paper text


def test_sections_report_what_was_found(client, store):
    scheme = client.get("/api/v1/papers").json()["papers"][1]
    assert (scheme["pages"], scheme["chunk_count"]) == (4, 4)
    assert [(s["paper"], s["part"], s["questions"]) for s in scheme["sections"]] == [
        ("I", "A", ["2", "10"]), ("II", "B", ["12"]), (None, None, []),
    ]


def test_counts_more_chunks_than_one_scroll_page(client, store):
    _index(store, 1, "marking_scheme", [Chunk(1, i, f"chunk {i}", page=i + 1) for i in range(1200)], year=2019)
    assert client.get("/api/v1/papers").json()["papers"][-1]["chunk_count"] == 1200


def test_read_returns_document_order(client, store):
    body = client.get(f"/api/v1/papers/{SCHEME}").json()
    assert [c["text"] for c in body["chunks"]] == ["cover page", "Q10 working", "Q2 working", "Q12 applied"]
    assert body["chunks"][2]["question"] == "2"


def test_read_drops_repeated_overlap(client, store):
    tail = "the end of a long working line"
    _index(store, 2, "marking_scheme", [Chunk(2, 0, f"first part {tail}"), Chunk(2, 1, f"{tail}\n\nsecond part")])
    texts = [c["text"] for c in client.get("/api/v1/papers/2").json()["chunks"]]
    assert texts == [f"first part {tail}", "second part"]


@pytest.mark.parametrize("upload_id", [PRIVATE, NOTES, 123456])
def test_read_hides_what_is_not_in_the_library(client, store, upload_id):
    resp = client.get(f"/api/v1/papers/{upload_id}")
    assert resp.status_code == 404 and resp.json()["detail"]["code"] == "paper_not_found"


def test_no_collection_yet_is_an_empty_library(client):
    app.dependency_overrides[papers.get_paper_store] = lambda: VectorStore.from_url(":memory:", None, "none", 4)
    _login()
    assert client.get("/api/v1/papers").json() == {"papers": []}


def test_store_failure_is_503(client):
    class Down:
        def scroll_payloads(self, *a, **k):
            raise ConnectionError

    app.dependency_overrides[papers.get_paper_store] = lambda: Down()
    _login()
    resp = client.get("/api/v1/papers")
    assert resp.status_code == 503 and resp.json()["detail"]["code"] == "papers_unavailable"


def test_clean_text_maps_symbol_font():
    assert clean_text("22  3r  7  r  5") == "22 − 3r = 7 ⇒ r = 5"
