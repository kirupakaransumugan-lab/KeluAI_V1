"""Builds the past-paper library from the vector store's chunk payloads.

Qdrant is the source of truth for what the tutor can cite, so listing it directly means
this page can never disagree with the RAG (and a new ingest shows up with no extra step).
Titles are not used for coverage: "Full paper" comes from the file name, while `sections`
reports what the chunker actually found in the document.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Iterable

from qdrant_client import models as qm

from app.rag.access import scope_filter
from app.rag.types import AccessScope
from app.rag.vector_store import VectorStore

LIBRARY_TYPES = ["past_paper", "marking_scheme"]
_LIST_FIELDS = ["upload_id", "upload_type", "language", "title", "exam_year", "page",
                "paper", "paper_part", "question_number"]
_TYPE_ORDER = {"past_paper": 0, "marking_scheme": 1}
_MAX_OVERLAP = 400          # chunk overlap is 200 chars; allow for a changed setting
_MIN_OVERLAP = 20           # shorter matches are coincidence, not a repeated tail

# PDFs set in the Symbol font extract as private-use characters (U+F0xx). Map the ones with
# a text form; the rest are pieces of tall brackets, which have no meaning on their own.
_SYMBOL_FONT = str.maketrans({
    "": "+", "": "−", "": "=", "": "<", "": ">", "": "∴",
    "": "×", "": "±", "": "≤", "": "≥", "": "→", "": "⇒",
    "": "⇔", "": "∈",
})
_SYMBOL_LEFTOVERS = re.compile("[-]")


def _library_filter(scope: AccessScope, *extra: qm.Condition) -> qm.Filter:
    return scope_filter(scope, narrow=[
        qm.FieldCondition(key="upload_type", match=qm.MatchAny(any=LIBRARY_TYPES)), *extra,
    ])


def _question_key(number: str) -> tuple[int, str]:
    return (int(number), number) if number.isdigit() else (10_000, number)


def _section_key(paper: str | None, part: str | None) -> tuple[bool, str, bool, str]:
    return (paper is None, paper or "", part is None, part or "")   # untagged sorts last


def _summarise(chunks: list[dict]) -> dict:
    first = chunks[0]
    sections: dict[tuple, dict] = defaultdict(lambda: {"chunks": 0, "questions": set()})
    for c in chunks:
        section = sections[(c.get("paper"), c.get("paper_part"))]
        section["chunks"] += 1
        if c.get("question_number"):
            section["questions"].add(c["question_number"])
    return {
        "upload_id": first["upload_id"],
        "upload_type": first["upload_type"],
        "exam_year": first.get("exam_year"),
        "language": first.get("language"),
        "title": first.get("title"),
        "pages": max((c.get("page") or 0 for c in chunks), default=0),
        "chunk_count": len(chunks),
        "sections": [
            {"paper": paper, "part": part, "chunks": s["chunks"],
             "questions": sorted(s["questions"], key=_question_key)}
            for (paper, part), s in sorted(sections.items(), key=lambda kv: _section_key(*kv[0]))
        ],
    }


def list_papers(store: VectorStore, scope: AccessScope) -> list[dict]:
    """Every paper the scope can see: newest year first, a question paper before its scheme."""
    by_upload: dict[int, list[dict]] = defaultdict(list)
    for payload in store.scroll_payloads(_library_filter(scope), fields=_LIST_FIELDS):
        by_upload[payload["upload_id"]].append(payload)
    papers = [_summarise(chunks) for chunks in by_upload.values()]
    return sorted(papers, key=lambda p: (-(p["exam_year"] or 0), _TYPE_ORDER[p["upload_type"]], p["upload_id"]))


def clean_text(text: str) -> str:
    return _SYMBOL_LEFTOVERS.sub("", text.translate(_SYMBOL_FONT))


def _without_overlap(previous: str, text: str) -> str:
    """Long chunks repeat the end of the one before (useful for search, not for reading)."""
    for size in range(min(_MAX_OVERLAP, len(previous), len(text)), _MIN_OVERLAP - 1, -1):
        if previous.endswith(text[:size]):
            return text[size:].lstrip()
    return text


def _reading_order(payloads: Iterable[dict]) -> list[dict]:
    out: list[dict] = []
    previous = ""
    for c in sorted(payloads, key=lambda p: p.get("chunk_index") or 0):
        raw = c.get("text") or ""
        text = clean_text(_without_overlap(previous, raw)).strip()
        previous = raw
        if text:
            out.append({"index": c.get("chunk_index"), "page": c.get("page"), "paper": c.get("paper"),
                        "part": c.get("paper_part"), "question": c.get("question_number"), "text": text})
    return out


def read_paper(store: VectorStore, scope: AccessScope, upload_id: int) -> dict | None:
    """One paper's text in document order, or None if it doesn't exist for this scope."""
    flt = _library_filter(scope, qm.FieldCondition(key="upload_id", match=qm.MatchValue(value=upload_id)))
    payloads = list(store.scroll_payloads(flt))
    if not payloads:
        return None
    return {**_summarise(payloads), "chunks": _reading_order(payloads)}
