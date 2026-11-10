"""Admin > Knowledge Base (app/services/knowledge_base.py) and Admin > Content
(app/services/admin_content.py).

A file is uploaded as the raw request body with its name in the query string
(?filename=...), so no multipart library is needed.
"""
import logging
from functools import lru_cache
from typing import Callable, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import get_current_admin
from app.api.v1.endpoints.papers import get_paper_store
from app.core.database import SessionLocal, get_db
from app.models.user import User
from app.rag.embeddings import Embedder
from app.rag.vector_store import VectorStore
from app.services import admin_content, knowledge_base as kb

log = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@lru_cache
def _embedder() -> Embedder:
    """The tutor's embedder (one model in memory); loading it the first time takes ~25 s."""
    from app.api.v1.endpoints.tutor import _retriever

    return _retriever().embedder


def get_kb_embedder() -> Callable[[], Embedder]:
    return _embedder


def get_kb_store() -> Callable[[], VectorStore]:
    return get_paper_store


def get_session_factory() -> Callable[[], Session]:
    return SessionLocal


def _fail(err: kb.KbError) -> None:
    code = status.HTTP_409_CONFLICT if err.code == "busy" else status.HTTP_422_UNPROCESSABLE_ENTITY
    raise HTTPException(code, detail={"code": err.code, "message": err.message})


@router.get("/knowledge-base")
def knowledge_base(get_store: Callable[[], VectorStore] = Depends(get_kb_store),
                   _: User = Depends(get_current_admin)) -> dict:
    try:
        return kb.list_documents(get_store())
    except Exception:
        log.exception("could not list the knowledge base")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "vector_db_unavailable"}) from None


@router.post("/knowledge-base/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload(request: Request, background: BackgroundTasks,
                 filename: str = Query(min_length=1, max_length=200),
                 lang: Literal["en", "ta"] = Query("en"),
                 get_store: Callable[[], VectorStore] = Depends(get_kb_store),
                 get_embedder: Callable[[], Embedder] = Depends(get_kb_embedder),
                 session_factory: Callable[[], Session] = Depends(get_session_factory),
                 _: User = Depends(get_current_admin)) -> dict:
    if kb.busy():
        _fail(kb.KbError("busy", "Another document is still being processed. Try again when it finishes."))
    data = await request.body()
    try:
        job, path, info = kb.prepare_upload(filename, data, lang)
    except kb.KbError as err:
        _fail(err)
    background.add_task(kb.run_upload, job["id"], path, info, get_store, get_embedder, session_factory)
    return job


@router.delete("/knowledge-base/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(upload_id: int, get_store: Callable[[], VectorStore] = Depends(get_kb_store),
           _: User = Depends(get_current_admin)) -> None:
    kb.remove_document(get_store(), upload_id)


@router.post("/knowledge-base/retag", status_code=status.HTTP_202_ACCEPTED)
def retag(background: BackgroundTasks,
          get_store: Callable[[], VectorStore] = Depends(get_kb_store),
          get_embedder: Callable[[], Embedder] = Depends(get_kb_embedder),
          session_factory: Callable[[], Session] = Depends(get_session_factory),
          _: User = Depends(get_current_admin)) -> dict:
    if kb.busy():
        _fail(kb.KbError("busy", "Another job is still running. Try again when it finishes."))
    job = kb.start_retag()
    background.add_task(kb.run_retag, job["id"], get_store, get_embedder, session_factory)
    return job


@router.get("/content")
def content(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    return admin_content.coverage(db)
