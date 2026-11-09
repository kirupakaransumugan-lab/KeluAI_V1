"""Past-paper library: what is indexed in the RAG, for students to browse and read.

Global library only: a private student upload never appears here, even for its owner
(those belong to "ask AI about my PDF"). No embedder is needed, so nothing here pays
the ~25 s model load the tutor does.
"""
import logging
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.models.user import User
from app.rag.config import get_rag_settings
from app.rag.types import AccessScope
from app.rag.vector_store import VectorStore
from app.services import past_papers

log = logging.getLogger(__name__)
router = APIRouter(prefix="/papers", tags=["papers"])


@lru_cache
def get_paper_store() -> VectorStore:
    s = get_rag_settings()
    return VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, s.embedding_dim)


def _scope(user: User) -> AccessScope:
    return AccessScope(user_id=user.id, role=user.role.value, include_private=False)


@router.get("")
def list_papers(user: User = Depends(get_current_user), store: VectorStore = Depends(get_paper_store)) -> dict:
    try:
        return {"papers": past_papers.list_papers(store, _scope(user))}
    except Exception:
        log.exception("could not list past papers")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "papers_unavailable"}) from None


@router.get("/{upload_id}")
def read_paper(upload_id: int, user: User = Depends(get_current_user),
               store: VectorStore = Depends(get_paper_store)) -> dict:
    try:
        paper = past_papers.read_paper(store, _scope(user), upload_id)
    except Exception:
        log.exception("could not read past paper %s", upload_id)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "papers_unavailable"}) from None
    if paper is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "paper_not_found"})
    return paper
