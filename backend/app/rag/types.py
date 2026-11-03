"""Plain data types shared by the RAG layer. No provider imports here."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

Language = Literal["ta", "en"]
UploadType = Literal["syllabus", "past_paper", "marking_scheme", "notes", "working"]
Visibility = Literal["private", "global"]


class TutorMode(str, Enum):
    PRACTICE = "practice"        # hints allowed, marking schemes hidden from the student
    EXAM = "exam"                # no tutoring until the attempt is submitted
    REVIEW = "review"            # after submission / saved question: marking schemes allowed
    FREE = "free"                # general "ask the tutor" chat


@dataclass(frozen=True)
class UploadRecord:
    """The subset of an `uploads` row the indexer needs."""
    upload_id: int
    user_id: int
    upload_type: UploadType
    visibility: Visibility
    language: Language | None
    title: str | None
    exam_year: int | None
    text: str                     # ocr_corrected_text or ocr_text or extracted PDF text
    pages: list[str] | None = None  # optional per-page text (keeps page numbers for citations)
    paper_coverage: str | None = None  # 'full' | 'pure' | 'applied' (past papers / schemes)


@dataclass
class Chunk:
    upload_id: int
    chunk_index: int
    text: str
    page: int | None = None
    paper: str | None = None          # 'I' (Pure) | 'II' (Applied)
    paper_part: str | None = None     # 'A' | 'B'
    question_number: str | None = None
    topic_ids: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class AccessScope:
    """Who is searching. Built by the backend from the authenticated user,
    NEVER from model output or request bodies."""
    user_id: int
    role: Literal["student", "admin"] = "student"
    include_private: bool = True  # student's own private uploads


@dataclass
class SearchHit:
    text: str
    score: float
    upload_id: int
    upload_type: str
    visibility: str
    language: str | None
    title: str | None
    exam_year: int | None
    page: int | None
    paper: str | None
    paper_part: str | None
    question_number: str | None

    def citation(self) -> dict:
        """Shape stored in tutor_messages.sources."""
        return {
            "upload_id": self.upload_id,
            "upload_type": self.upload_type,
            "title": self.title,
            "exam_year": self.exam_year,
            "page": self.page,
            "paper": self.paper,
            "paper_part": self.paper_part,
            "question_number": self.question_number,
        }
