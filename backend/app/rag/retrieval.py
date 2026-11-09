"""Retrieval service used by the agent's tools. Every call takes an AccessScope."""
from __future__ import annotations

from qdrant_client import models as qm

from .access import scope_filter
from .embeddings import Embedder
from .types import AccessScope, SearchHit
from .vector_store import VectorStore


_PAPER_ALIASES = {"I": "I", "1": "I", "PURE": "I", "II": "II", "2": "II", "APPLIED": "II"}


def normalise_coordinates(paper: str | None, paper_part: str | None) -> tuple[str | None, str | None]:
    """'II-B' -> ('II','B'); 'pure' -> 'I'; unknown values are dropped, not guessed."""
    p = (paper or "").strip().upper()
    part = (paper_part or "").strip().upper().replace(" ", "").replace("–", "-")
    if "-" in part:
        lead, part = part.split("-", 1)
        p = p or lead
    return _PAPER_ALIASES.get(p), (part if part in ("A", "B") else None)


def _kw(key: str, value) -> qm.FieldCondition:
    return qm.FieldCondition(key=key, match=qm.MatchValue(value=value))


class Retriever:
    def __init__(self, store: VectorStore, embedder: Embedder, top_k: int = 6, min_score: float = 0.35):
        self.store = store
        self.embedder = embedder
        self.top_k = top_k
        self.min_score = min_score

    def search(self, scope: AccessScope, query: str, *,
               upload_types: list[str] | None = None,
               exam_year: int | None = None,
               language: str | None = None,
               upload_id: int | None = None,
               limit: int | None = None) -> list[SearchHit]:
        narrow: list[qm.Condition] = []
        if upload_types:
            narrow.append(qm.FieldCondition(key="upload_type", match=qm.MatchAny(any=upload_types)))
        if exam_year:
            narrow.append(_kw("exam_year", exam_year))
        if language:
            narrow.append(_kw("language", language))
        if upload_id:
            narrow.append(_kw("upload_id", upload_id))
        flt = scope_filter(scope, narrow=narrow)
        vec = self.embedder.embed_query(query)
        return self.store.search(vec, flt, limit=min(limit or self.top_k, 12), min_score=self.min_score)

    def by_topic(self, scope: AccessScope, topic_id: int, *, upload_types: list[str], limit: int = 50) -> list[SearchHit]:
        """Chunks tagged with this topic in Qdrant (`topic_ids`). No embedding, so it's instant."""
        narrow: list[qm.Condition] = [
            qm.FieldCondition(key="topic_ids", match=qm.MatchValue(value=topic_id)),
            qm.FieldCondition(key="upload_type", match=qm.MatchAny(any=upload_types)),
        ]
        return self.store.scroll(scope_filter(scope, narrow=narrow), limit=limit)

    def get_question(self, scope: AccessScope, *, exam_year: int, question_number: str,
                     paper: str | None = None, paper_part: str | None = None,
                     upload_type: str = "past_paper",
                     language: str | None = None) -> list[SearchHit]:
        """Exact lookup by paper coordinates (no embedding).
        paper: I/II, 1/2 or pure/applied. paper_part: A/B, or combined like 'II-B'."""
        paper, paper_part = normalise_coordinates(paper, paper_part)
        narrow: list[qm.Condition] = [
            _kw("upload_type", upload_type),
            _kw("exam_year", exam_year),
            _kw("question_number", str(question_number).strip().lstrip("Qq")),
        ]
        if paper:
            narrow.append(_kw("paper", paper))
        if paper_part:
            narrow.append(_kw("paper_part", paper_part))
        if language:
            narrow.append(_kw("language", language))
        return self.store.scroll(scope_filter(scope, narrow=narrow), limit=20)

    def list_questions(self, scope: AccessScope, *, paper: str | None = None,
                       paper_part: str | None = None, upload_type: str = "past_paper",
                       limit: int = 1000) -> list[SearchHit]:
        """Every indexed question at these coordinates, across all years (no embedding).
        Used by the quiz generator to pick style examples."""
        paper, paper_part = normalise_coordinates(paper, paper_part)
        narrow: list[qm.Condition] = [_kw("upload_type", upload_type)]
        if paper:
            narrow.append(_kw("paper", paper))
        if paper_part:
            narrow.append(_kw("paper_part", paper_part))
        return [h for h in self.store.scroll(scope_filter(scope, narrow=narrow), limit=limit)
                if h.question_number]
