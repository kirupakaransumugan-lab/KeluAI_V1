"""Links Qdrant chunks to the topics table by writing topic ids into each chunk's `topic_ids`.

Chunks say nothing about their topic when indexed, so each topic's name is searched for and
its closest chunks are tagged. Pure topics only look at Paper I and Applied topics at Paper II;
chunks with no paper tag can match either. A chunk can have several topics. This is an
approximate match from embeddings, good for choosing style examples, not a checked mapping.

Re-indexing a paper clears its tags, so run `python -m app.manage tag-topics` after any ingest.
"""
from __future__ import annotations

from collections import defaultdict

from qdrant_client import models as qm

from app.rag.embeddings import Embedder
from app.rag.vector_store import VectorStore
from app.services.topics import TOPICS

CHUNKS_PER_TOPIC = 8
LIBRARY_TYPES = ["past_paper", "marking_scheme"]


OTHER_PAPER = {"pure": "II", "applied": "I"}


def _library(strand: str | None = None) -> qm.Filter:
    """The shared papers only (a student's private upload is never tagged or served), without
    the paper a topic of this strand can't be on."""
    return qm.Filter(
        must=[
            qm.FieldCondition(key="visibility", match=qm.MatchValue(value="global")),
            qm.FieldCondition(key="upload_type", match=qm.MatchAny(any=LIBRARY_TYPES)),
        ],
        must_not=[qm.FieldCondition(key="paper", match=qm.MatchValue(value=OTHER_PAPER[strand]))] if strand else None,
    )


def tag_chunks(store: VectorStore, embedder: Embedder, min_score: float) -> dict[int, int]:
    """Re-tag the whole library -> {topic id: chunks tagged}. Safe to run again."""
    topics_of: dict[str, list[int]] = defaultdict(list)
    counts: dict[int, int] = {}
    for topic in TOPICS:
        ids = store.search_ids(embedder.embed_query(topic.en), _library(topic.strand), CHUNKS_PER_TOPIC, min_score)
        counts[topic.id] = len(ids)
        for point in ids:
            topics_of[point].append(topic.id)
    store.clear_topic_ids(_library())
    store.set_topic_ids(topics_of)
    return counts
