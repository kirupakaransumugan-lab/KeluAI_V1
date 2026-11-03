"""Indexing pipeline: uploads row -> chunks -> embeddings -> vector DB.

Pure logic, no DB session: the worker (app/workers/index_worker.py) reads the
uploads row, calls `index_upload`, and writes the returned status back.

Idempotent: point ids are deterministic (upload_id, chunk_index), and old
chunks for the upload are deleted first, so re-indexing after an OCR
correction or a re-upload never leaves stale chunks behind.
"""
from __future__ import annotations

from dataclasses import dataclass

from .chunking import chunk_upload
from .embeddings import Embedder
from .types import UploadRecord
from .vector_store import VectorStore, vector_doc_id

INDEXABLE_TYPES = {"syllabus", "past_paper", "marking_scheme", "notes"}


class NotIndexable(ValueError):
    pass


@dataclass
class IndexResult:
    vector_doc_id: str
    chunk_count: int


def index_upload(rec: UploadRecord, store: VectorStore, embedder: Embedder,
                 *, max_chars: int = 1800, overlap: int = 200) -> IndexResult:
    if rec.upload_type not in INDEXABLE_TYPES:
        raise NotIndexable(f"upload_type '{rec.upload_type}' is never indexed")
    if rec.upload_type == "notes" and rec.visibility != "private":
        # Student notes stay private; only admin knowledge-base types can be global.
        raise NotIndexable("student notes must be private")
    if not (rec.text or rec.pages):
        raise NotIndexable("no extracted text; run OCR / extraction first")

    chunks = chunk_upload(rec, max_chars=max_chars, overlap=overlap)
    if not chunks:
        raise NotIndexable("document produced no chunks")

    # Embed with a small header so the vector carries context (year/part/Q).
    def _embed_text(c) -> str:
        head = " ".join(str(x) for x in (
            rec.upload_type.replace("_", " "), rec.exam_year or "",
            {"I": "paper I pure mathematics", "II": "paper II applied mathematics"}.get(c.paper or "", ""),
            f"part {c.paper_part}" if c.paper_part else "",
            f"question {c.question_number}" if c.question_number else "",
        ) if x)
        return f"{head}\n{c.text}"

    vectors = embedder.embed_documents([_embed_text(c) for c in chunks])

    store.delete_upload(rec.upload_id)
    store.upsert_chunks(rec, chunks, vectors)
    return IndexResult(vector_doc_id=vector_doc_id(rec.upload_id), chunk_count=len(chunks))


def remove_upload(upload_id: int, store: VectorStore) -> None:
    """Call BEFORE deleting the uploads row or the file (and on account deletion)."""
    store.delete_upload(upload_id)
