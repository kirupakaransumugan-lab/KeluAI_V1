"""Admin > Knowledge Base: the shared documents the AI tutor can cite, read from Qdrant.

Qdrant is the source of truth for what is indexed, so the list can't disagree with the RAG.
Adding a document runs the same pipeline as `python -m app.rag.cli`: a PDF named by the
convention in app/rag/filenames.py gets its text layer read (or is OCR'd with the OpenRouter
vision model when it is a scan), then it is chunked, embedded and indexed, and the library's
topic tags are refreshed. A .txt/.md file is indexed as a syllabus/notes document.

That work takes minutes, so it runs as a background job. Job progress lives in this process's
memory: a restart forgets it (the indexed documents themselves are safe in Qdrant), and it
assumes one API worker, which is how the backend runs today.
"""
from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable

from qdrant_client import models as qm
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.topic import SyllabusTopic
from app.rag.cli import ADMIN_USER_ID, text_upload_id, upload_id_for
from app.rag.config import BACKEND_DIR, get_rag_settings
from app.rag.embeddings import Embedder
from app.rag.filenames import FilenameError, parse_kb_filename
from app.rag.ingestion import NotIndexable, index_upload
from app.rag.ocr import extract_text_pages, load_pages, ocr_pdf, openrouter_transcriber
from app.rag.types import UploadRecord
from app.rag.vector_store import VectorStore
from app.services.past_papers import _summarise
from app.services.topic_tags import tag_chunks

log = logging.getLogger(__name__)

KB_TYPES = ["past_paper", "marking_scheme", "syllabus"]
TYPE_ORDER = {"past_paper": 0, "marking_scheme": 1, "syllabus": 2}
FIELDS = ["upload_id", "upload_type", "language", "title", "exam_year", "page", "paper", "paper_part",
          "question_number"]
MAX_BYTES = 60 * 1024 * 1024
UPLOAD_DIR = BACKEND_DIR / "var" / "kb"
JOBS_KEPT = 20


class KbError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(code)
        self.code, self.message = code, message


# ---------------------------------------------------------------- listing

def _global_filter() -> qm.Filter:
    return qm.Filter(must=[
        qm.FieldCondition(key="visibility", match=qm.MatchValue(value="global")),
        qm.FieldCondition(key="upload_type", match=qm.MatchAny(any=KB_TYPES)),
    ])


def list_documents(store: VectorStore) -> dict:
    by_upload: dict[int, list[dict]] = {}
    for payload in store.scroll_payloads(_global_filter(), fields=FIELDS):
        by_upload.setdefault(payload["upload_id"], []).append(payload)
    docs = []
    for chunks in by_upload.values():
        s = _summarise(chunks)
        docs.append({k: s[k] for k in ("upload_id", "upload_type", "exam_year", "language", "title", "pages",
                                       "chunk_count")} | {"sections": len(s["sections"])})
    docs.sort(key=lambda d: (TYPE_ORDER.get(d["upload_type"], 9), -(d["exam_year"] or 0), d["language"] or "",
                             d["upload_id"]))
    return {
        "documents": docs,
        "totals": {
            "documents": len(docs), "chunks": sum(d["chunk_count"] for d in docs),
            "years": len({d["exam_year"] for d in docs if d["exam_year"]}),
            "by_type": {t: sum(d["upload_type"] == t for d in docs) for t in KB_TYPES},
            "by_language": {lang: sum(d["language"] == lang for d in docs) for lang in ("en", "ta")},
        },
        "collection": store.collection,
        "jobs": list_jobs(),
    }


def remove_document(store: VectorStore, upload_id: int) -> None:
    store.delete_upload(upload_id)


# ---------------------------------------------------------------- jobs

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _iso(at: datetime | None) -> str | None:
    return f"{at.isoformat()}Z" if at else None


def _new_job(kind: str, filename: str) -> dict:
    job = {"id": uuid.uuid4().hex[:12], "kind": kind, "filename": filename, "status": "queued",
           "stage": "Waiting to start", "message": None, "chunk_count": None, "upload_id": None,
           "started_at": _iso(utcnow()), "finished_at": None}
    with _lock:
        _jobs[job["id"]] = job
        for old in sorted(_jobs.values(), key=lambda j: j["started_at"])[:-JOBS_KEPT]:
            if old["status"] in ("done", "failed"):
                _jobs.pop(old["id"], None)
    return dict(job)


def _set(job_id: str, **changes) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(changes)


def list_jobs() -> list[dict]:
    with _lock:
        return sorted((dict(j) for j in _jobs.values()), key=lambda j: j["started_at"], reverse=True)


def busy() -> bool:
    return any(j["status"] in ("queued", "running") for j in list_jobs())


# ---------------------------------------------------------------- adding a document

def prepare_upload(filename: str, data: bytes, language: str) -> tuple[dict, Path, dict]:
    """Check the file and save it under var/kb. Returns (job, saved path, document info)."""
    name = Path(filename).name.strip()
    suffix = Path(name).suffix.lower()
    if not data:
        raise KbError("empty_file", "The file is empty.")
    if len(data) > MAX_BYTES:
        raise KbError("file_too_large", f"Files can be up to {MAX_BYTES // (1024 * 1024)} MB.")
    if suffix == ".pdf":
        if not data.startswith(b"%PDF"):
            raise KbError("not_a_pdf", "That file isn't a PDF.")
        try:
            parsed = parse_kb_filename(name)
        except FilenameError as e:
            raise KbError("bad_filename", str(e)) from None
        info = {"kind": "pdf", "upload_id": upload_id_for(parsed), "upload_type": parsed.upload_type,
                "language": parsed.language, "title": parsed.title, "exam_year": parsed.exam_year,
                "paper_coverage": parsed.paper_coverage, "stem": Path(parsed.canonical_name).stem}
        saved = UPLOAD_DIR / parsed.canonical_name
    elif suffix in (".txt", ".md"):
        try:
            data.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise KbError("bad_encoding", "Text files must be saved as UTF-8.") from None
        info = {"kind": "text", "upload_id": text_upload_id(Path(name)), "upload_type": "syllabus",
                "language": language, "title": Path(name).stem, "exam_year": None}
        saved = UPLOAD_DIR / name
    else:
        raise KbError("bad_type", "Upload a PDF past paper / marking scheme, or a .txt / .md document.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved.write_bytes(data)
    job = _new_job("upload", name)
    _set(job["id"], upload_id=info["upload_id"])
    return job, saved, info


def _pages_for(job_id: str, path: Path, info: dict) -> list[str]:
    s = get_rag_settings()
    out_dir = Path(s.ocr_dir) / info["stem"]
    pages = load_pages(out_dir)
    if pages:
        return pages                                       # read before (re-upload): reuse the text
    _set(job_id, stage="Reading the PDF's text")
    if extract_text_pages(path, out_dir):
        return load_pages(out_dir) or []
    if not s.openrouter_api_key:
        raise KbError("ocr_not_configured", "This PDF is a scan and needs OCR, but LLM_API_KEY isn't set in backend/.env.")
    from app.rag.agent.tutor_agent import build_llm

    _set(job_id, stage="Scanned PDF: reading each page with the AI (a few minutes)")
    ocr_pdf(path, out_dir, openrouter_transcriber(build_llm(s.openrouter_api_key, s.openrouter_base_url), s.ocr_model),
            workers=s.ocr_workers)
    return load_pages(out_dir) or []


def run_upload(job_id: str, path: Path, info: dict, get_store: Callable[[], VectorStore],
               get_embedder: Callable[[], Embedder], session_factory: Callable[[], Session]) -> None:
    _set(job_id, status="running")
    try:
        if info["kind"] == "pdf":
            pages = _pages_for(job_id, path, info)
            text = "\f".join(pages)
        else:
            text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
            pages = text.split("\f") if "\f" in text else None
        if not text.strip():
            raise KbError("no_text", "No text could be read from this file.")
        rec = UploadRecord(upload_id=info["upload_id"], user_id=ADMIN_USER_ID, upload_type=info["upload_type"],
                           visibility="global", language=info["language"], title=info["title"],
                           exam_year=info["exam_year"], text=text, pages=pages,
                           paper_coverage=info.get("paper_coverage"))
        _set(job_id, stage="Loading the embedding model")
        store, embedder = get_store(), get_embedder()
        store.ensure_collection()
        _set(job_id, stage="Splitting and indexing")
        s = get_rag_settings()
        res = index_upload(rec, store, embedder, max_chars=s.chunk_max_chars, overlap=s.chunk_overlap_chars)
        _set(job_id, chunk_count=res.chunk_count)
        if info["upload_type"] in ("past_paper", "marking_scheme"):
            _set(job_id, stage="Updating topic tags")
            _retag(store, embedder, session_factory)
        _set(job_id, status="done", stage="Indexed", finished_at=_iso(utcnow()))
    except (KbError, NotIndexable) as e:
        _set(job_id, status="failed", stage="Failed", message=getattr(e, "message", "") or str(e),
             finished_at=_iso(utcnow()))
    except Exception as e:                                  # keep the job visible, never crash the worker
        log.exception("knowledge-base job %s failed", job_id)
        _set(job_id, status="failed", stage="Failed", message=f"Unexpected error: {e}", finished_at=_iso(utcnow()))


def _retag(store: VectorStore, embedder: Embedder, session_factory: Callable[[], Session]) -> dict[int, int]:
    counts = tag_chunks(store, embedder, get_rag_settings().retrieval_min_score)
    with session_factory() as db:
        for topic_id, n in counts.items():
            db.execute(update(SyllabusTopic).where(SyllabusTopic.id == topic_id).values(chunk_count=n))
        db.commit()
    return counts


def start_retag() -> dict:
    return _new_job("retag", "Topic tags")


def run_retag(job_id: str, get_store: Callable[[], VectorStore], get_embedder: Callable[[], Embedder],
              session_factory: Callable[[], Session]) -> None:
    _set(job_id, status="running", stage="Matching chunks to syllabus topics")
    try:
        counts = _retag(get_store(), get_embedder(), session_factory)
        _set(job_id, status="done", stage="Topic tags updated", chunk_count=sum(counts.values()),
             finished_at=_iso(utcnow()))
    except Exception as e:
        log.exception("retag job %s failed", job_id)
        _set(job_id, status="failed", stage="Failed", message=str(e), finished_at=_iso(utcnow()))
