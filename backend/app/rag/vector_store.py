"""Qdrant adapter. The rest of the app talks to `VectorStore`, so swapping
providers later touches only this file.

Payload on every point (what lets every search be filtered):
  upload_id, owner_user_id, visibility, upload_type, language, title,
  exam_year, page, paper, paper_part, question_number, chunk_index, text
"""
from __future__ import annotations

import uuid
from typing import Iterable

from qdrant_client import QdrantClient
from qdrant_client import models as qm

from .types import Chunk, SearchHit, UploadRecord

# Fixed namespace so point ids are deterministic -> re-indexing is idempotent.
_NS = uuid.UUID("6b0f4a52-8a7e-4c1e-9d1a-4b454c550001")

_KEYWORD_FIELDS = ("visibility", "upload_type", "language", "paper", "paper_part", "question_number")
_INT_FIELDS = ("upload_id", "owner_user_id", "exam_year")


def point_id(upload_id: int, chunk_index: int) -> str:
    return str(uuid.uuid5(_NS, f"{upload_id}:{chunk_index}"))


def vector_doc_id(upload_id: int) -> str:
    """Value stored in uploads.vector_doc_id."""
    return f"upl_{upload_id}"


class VectorStore:
    def __init__(self, client: QdrantClient, collection: str, dim: int):
        self.client = client
        self.collection = collection
        self.dim = dim

    @classmethod
    def from_url(cls, url: str, api_key: str | None, collection: str, dim: int) -> "VectorStore":
        """url: http(s)://host:port (server), ":memory:" (tests), or a folder path
        (embedded on-disk mode, no server; one process at a time)."""
        if url == ":memory:":
            client = QdrantClient(location=":memory:")
        elif url.startswith(("http://", "https://")):
            client = QdrantClient(url=url, api_key=api_key)
        else:
            client = QdrantClient(path=url)
        return cls(client, collection, dim)

    # ---- setup -------------------------------------------------------------
    def ensure_collection(self) -> None:
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=qm.VectorParams(size=self.dim, distance=qm.Distance.COSINE),
            )
        for f in _KEYWORD_FIELDS:
            self.client.create_payload_index(self.collection, field_name=f,
                                             field_schema=qm.PayloadSchemaType.KEYWORD)
        for f in _INT_FIELDS:
            self.client.create_payload_index(self.collection, field_name=f,
                                             field_schema=qm.PayloadSchemaType.INTEGER)

    # ---- write -------------------------------------------------------------
    def upsert_chunks(self, rec: UploadRecord, chunks: list[Chunk], vectors: list[list[float]],
                      batch_size: int = 128) -> None:
        points = [
            qm.PointStruct(
                id=point_id(rec.upload_id, c.chunk_index),
                vector=v,
                payload={
                    "upload_id": rec.upload_id,
                    "owner_user_id": rec.user_id,
                    "visibility": rec.visibility,
                    "upload_type": rec.upload_type,
                    "language": rec.language,
                    "title": rec.title,
                    "exam_year": rec.exam_year,
                    "page": c.page,
                    "paper": c.paper,
                    "paper_part": c.paper_part,
                    "question_number": c.question_number,
                    "topic_ids": c.topic_ids,
                    "chunk_index": c.chunk_index,
                    "text": c.text,
                },
            )
            for c, v in zip(chunks, vectors, strict=True)
        ]
        for i in range(0, len(points), batch_size):
            self.client.upsert(self.collection, points=points[i:i + batch_size], wait=True)

    def delete_upload(self, upload_id: int) -> None:
        self.client.delete(
            self.collection,
            points_selector=qm.FilterSelector(filter=qm.Filter(must=[
                qm.FieldCondition(key="upload_id", match=qm.MatchValue(value=upload_id))
            ])),
            wait=True,
        )

    def set_visibility(self, upload_id: int, visibility: str) -> None:
        """Keeps vector payload in sync if an admin publishes/unpublishes a file."""
        self.client.set_payload(
            self.collection, payload={"visibility": visibility},
            points=qm.Filter(must=[qm.FieldCondition(key="upload_id", match=qm.MatchValue(value=upload_id))]),
            wait=True,
        )

    # ---- read --------------------------------------------------------------
    def search(self, vector: list[float], flt: qm.Filter, limit: int, min_score: float = 0.0) -> list[SearchHit]:
        res = self.client.query_points(
            self.collection, query=vector, query_filter=flt, limit=limit,
            with_payload=True, score_threshold=min_score or None,
        )
        return [_to_hit(p.payload or {}, p.score) for p in res.points]

    def scroll(self, flt: qm.Filter, limit: int = 20) -> list[SearchHit]:
        """Exact (non-semantic) lookup, e.g. a specific past-paper question."""
        points, _ = self.client.scroll(self.collection, scroll_filter=flt, limit=limit, with_payload=True)
        hits = [_to_hit(p.payload or {}, 1.0) for p in points]
        return sorted(hits, key=lambda h: (h.upload_id, h.page or 0))

    def count_for_upload(self, upload_id: int) -> int:
        return self.client.count(self.collection, count_filter=qm.Filter(must=[
            qm.FieldCondition(key="upload_id", match=qm.MatchValue(value=upload_id))
        ]), exact=True).count


def _to_hit(p: dict, score: float) -> SearchHit:
    return SearchHit(
        text=p.get("text", ""), score=float(score),
        upload_id=p.get("upload_id"), upload_type=p.get("upload_type"),
        visibility=p.get("visibility"), language=p.get("language"),
        title=p.get("title"), exam_year=p.get("exam_year"), page=p.get("page"), paper=p.get("paper"),
        paper_part=p.get("paper_part"), question_number=p.get("question_number"),
    )


def chunks_in_order(hits: Iterable[SearchHit]) -> list[SearchHit]:
    return sorted(hits, key=lambda h: (h.page or 0))
