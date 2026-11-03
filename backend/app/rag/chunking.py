"""Question-aware chunking.

Past papers and marking schemes are split per QUESTION, not per N tokens,
so a chunk = one exam question (or its marking scheme). Each chunk carries
its coordinates:

    paper            'I' (Pure) or 'II' (Applied)
    paper_part       'A' or 'B'
    question_number  '1' .. '17'

A "full" PDF holds Paper I and Paper II back to back, and both number their
questions from 1, so the paper must be part of the key. The chunker detects
paper headings (English and Tamil, plus exam codes like "10 T I"); for a
"pure"/"applied" file the paper defaults from the file's coverage.

Syllabus and notes fall back to paragraph-packing with overlap.
"""
from __future__ import annotations

import re

from .filenames import DEFAULT_PAPER
from .types import Chunk, UploadRecord

# Paper headings. II must be tried before I.
_PAPER_RE = re.compile(
    r"(?:Combined\s+Mathematics|இணைந்த\s+கணிதம்|Paper|பத்திரம்|வினாத்தாள்)\s*[-–:]?\s*(II|I)\b"
    r"|\b10\s*/?\s*[TES]\s*[-–]?\s*(II|I)\b"     # exam paper codes: 10 T I, 10 E II, AL/2016/10/E-I
    # "10 – <subject> II" title line; the subject may be mangled Tamil from a PDF
    # text layer. Case-sensitive so sub-parts like "(ii)" never read as Paper II.
    r"|(?-i:\b10[^\S\n]*[–-][^\n]{0,40}?(?<![A-Za-z])(II|I)\b)",
    re.I,
)
# "PART A", "Part B", "PART I-A" ... and Tamil "பகுதி A"; also at the end of a
# running header like "AL/2016/10/E-I - 2 - Part A"
_PART_RE = re.compile(r"(?:^\s*|-[^\S\n]*)(?:PART|பகுதி)\s+(?:(II|I)\s*[-–]?\s*)?([AB])\b", re.M | re.I)
# Question starts: "5.", "5)", "(5)", "Q5.", "Question 5." at line start
_Q_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*)?\(?(\d{1,2})[.)]\s+", re.M)
# Transcribed marking schemes head each question with a line "Question 12" / "வினா 12"
# and also start lines with marks like "(5)". When such headings exist, use only them.
_QHEAD_RE = re.compile(r"^\s*(?:Question|வினா)\s+(\d{1,2})\b", re.M | re.I)
# Marking schemes without such headings: no reliable question starts (their numbered
# lines are marking instructions or working), so they are not split per question.
_NO_Q_RE = re.compile(r"(?!)")
# The question marker itself ("5.", "(10)", "Question 12"), to tell an empty question.
_MARKER_RE = re.compile(r"^\s*(?:Q(?:uestion)?|வினா)?\s*\(?\d{1,2}[.)]?", re.I)


def part_for(question_number: str) -> str | None:
    """A/L Combined Maths layout is fixed: Part A = Q1-10, Part B = Q11-17.
    More reliable than part headings, which OCR often drops or misplaces."""
    n = int(question_number)
    return "A" if 1 <= n <= 10 else "B" if n <= 17 else None


def _pack(text: str, max_chars: int, overlap: int) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out: list[str] = []
    buf = ""
    for p in paras:
        while len(p) > max_chars:  # hard-split very long paragraphs
            out.append(p[:max_chars])
            p = p[max_chars - overlap:]
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                out.append(buf)
            tail = buf[-overlap:] if overlap and buf else ""
            buf = f"{tail}\n\n{p}" if tail else p
    if buf:
        out.append(buf)
    return out


class _Cursor:
    """Where we are in the paper; carried across pages."""
    def __init__(self, paper: str | None):
        self.paper = paper
        self.part: str | None = None

    def set_paper(self, paper: str) -> None:
        if paper != self.paper:          # new paper starts: forget the old part
            self.paper, self.part = paper, None


def _segments(text: str, cur: _Cursor,
              q_re: re.Pattern = _Q_RE) -> list[tuple[str | None, str | None, str | None, str]]:
    """Split one page into (paper, part, question_number, text) segments."""
    marks: list[tuple[int, str, tuple]] = []
    for m in _PAPER_RE.finditer(text):
        marks.append((m.start(), "paper", (next(g for g in m.groups() if g).upper(),)))
    for m in _PART_RE.finditer(text):
        marks.append((m.start(), "part", ((m.group(1) or "").upper() or None, m.group(2).upper())))
    for m in q_re.finditer(text):
        marks.append((m.start(), "q", (m.group(1),)))
    marks.sort(key=lambda x: x[0])

    out: list[tuple[str | None, str | None, str | None, str]] = []
    first_q = next((off for off, kind, _ in marks if kind == "q"), len(text))
    open_q: tuple[int, str] | None = None   # (start offset, number)

    def close(end: int) -> None:
        if open_q:
            body = text[open_q[0]:end].strip()
            if len(_MARKER_RE.sub("", body, count=1).strip()) > 2:   # skip a bare marker like "(10)"
                out.append((cur.paper, part_for(open_q[1]) or cur.part, open_q[1], body))

    # Text before the first question (cover page, instructions) is kept as one segment.
    pre = text[:first_q].strip()
    for off, kind, val in marks:
        if off >= first_q:
            break
        if kind == "paper":
            cur.set_paper(val[0])
        elif kind == "part":
            if val[0]:
                cur.set_paper(val[0])
            cur.part = val[1]
    # Skip it if it is only headings ("பகுதி B", "Combined Mathematics I", "10 T I").
    if pre and _PAPER_RE.sub("", _PART_RE.sub("", pre)).strip():
        out.append((cur.paper, cur.part, None, pre))

    for off, kind, val in marks:
        if off < first_q:
            continue
        if kind == "q":
            close(off)
            open_q = (off, val[0])
        elif kind == "paper":
            # A running header ("Combined Mathematics I" on every page) mid-question
            # must not cut the question; only a CHANGE of paper ends it.
            if val[0] != cur.paper:
                close(off)
                open_q = None
                cur.set_paper(val[0])
        else:  # part heading ends the current question
            close(off)
            open_q = None
            if val[0]:
                cur.set_paper(val[0])
            cur.part = val[1]
    close(len(text))
    return out


def chunk_upload(rec: UploadRecord, *, max_chars: int = 1800, overlap: int = 200) -> list[Chunk]:
    pages = rec.pages or [rec.text]
    chunks: list[Chunk] = []
    idx = 0

    if rec.upload_type in ("past_paper", "marking_scheme"):
        cur = _Cursor(DEFAULT_PAPER.get(rec.paper_coverage or "full"))
        if any(_QHEAD_RE.search(p) for p in pages):
            q_re = _QHEAD_RE
        else:
            q_re = _Q_RE if rec.upload_type == "past_paper" else _NO_Q_RE
        for page_no, page_text in enumerate(pages, start=1):
            for paper, part, qnum, body in _segments(page_text, cur, q_re):
                for piece in _pack(body, max_chars, overlap):
                    chunks.append(Chunk(
                        upload_id=rec.upload_id, chunk_index=idx, text=piece,
                        page=page_no if rec.pages else None,
                        paper=paper, paper_part=part, question_number=qnum,
                    ))
                    idx += 1
        return chunks

    for page_no, page_text in enumerate(pages, start=1):
        for piece in _pack(page_text, max_chars, overlap):
            chunks.append(Chunk(
                upload_id=rec.upload_id, chunk_index=idx, text=piece,
                page=page_no if rec.pages else None,
            ))
            idx += 1
    return chunks
