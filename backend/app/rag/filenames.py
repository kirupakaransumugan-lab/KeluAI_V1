"""Parse KELU's knowledge-base file naming convention.

Convention (tokens may be separated by space, _ or -; case doesn't matter):

    <year> combinedmaths <full|pure|applied> <TM|TN|EM|EN> [Msch]

    2019_combinedmaths_full_TM.pdf        -> 2019 past paper, Paper I + II, Tamil medium
    2019 combinedmaths full TM Msch.pdf   -> 2019 marking scheme, Paper I + II, Tamil medium
    2021-combinedmaths-pure-EM.pdf        -> 2021 past paper, Paper I only, English medium
    2016 Combined Maths Full EN.pdf       -> 2016 past paper, Paper I + II, English medium

  full    = whole paper: Paper I (Pure) + Paper II (Applied)
  pure    = Paper I only
  applied = Paper II only
  TM / TN = Tamil medium;  EM / EN = English medium
  Msch    = marking scheme (otherwise it is the question paper)

Used by the admin upload endpoint to pre-fill upload_type, language,
exam_year, paper_coverage and title (the admin can still edit them), and
by the indexer as a fallback when paper_coverage was not stored.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import PurePath

_MEDIUM = {"tm": "ta", "tn": "ta", "em": "en", "en": "en"}
_UNSUPPORTED_MEDIUM = {"sm": "Sinhala medium is not supported yet"}
_SCHEME = {"msch", "ms", "markingscheme", "scheme"}
_COVERAGE = {"full": "full", "pure": "pure", "applied": "applied"}
_SUBJECT = {"combinedmaths", "combinedmathematics", "cm"}

COVERAGE_LABEL = {
    "full": "Full paper (Pure + Applied)",
    "pure": "Paper I (Pure)",
    "applied": "Paper II (Applied)",
}
DEFAULT_PAPER = {"pure": "I", "applied": "II", "full": None}


class FilenameError(ValueError):
    pass


@dataclass
class ParsedPaperName:
    exam_year: int
    language: str              # 'ta' | 'en'
    upload_type: str           # 'past_paper' | 'marking_scheme'
    paper_coverage: str        # 'full' | 'pure' | 'applied'
    title: str
    canonical_name: str        # how we'd name it ourselves
    warnings: list[str] = field(default_factory=list)


def parse_kb_filename(filename: str) -> ParsedPaperName:
    stem = PurePath(filename.replace("\\", "/")).stem.lower()
    # Glue common spellings of the subject into one token first.
    stem = re.sub(r"combined[\s_\-]*math(?:ematic)?s?", "combinedmaths", stem)
    stem = re.sub(r"marking[\s_\-]*scheme", "markingscheme", stem)
    tokens = [t for t in re.split(r"[\s_\-.()]+", stem) if t]

    year = medium = coverage = None
    is_scheme = False
    subject_seen = False
    unknown: list[str] = []

    for t in tokens:
        if re.fullmatch(r"(19|20)\d{2}", t):
            if year and int(t) != year:
                raise FilenameError(f"two different years in '{filename}'")
            year = int(t)
        elif t in _MEDIUM:
            medium = _MEDIUM[t]
        elif t in _UNSUPPORTED_MEDIUM:
            raise FilenameError(_UNSUPPORTED_MEDIUM[t])
        elif t in _SCHEME:
            is_scheme = True
        elif t in _COVERAGE:
            coverage = _COVERAGE[t]
        elif t in _SUBJECT:
            subject_seen = True
        else:
            unknown.append(t)

    if year is None:
        raise FilenameError(f"no exam year found in '{filename}'")
    if medium is None:
        raise FilenameError(f"no medium (TM/TN or EM/EN) found in '{filename}'")

    warnings = []
    if not subject_seen:
        warnings.append("subject 'combinedmaths' not in filename; assumed Combined Mathematics")
    if coverage is None:
        coverage = "full"
        warnings.append("no full/pure/applied in filename; assumed full")
    if unknown:
        warnings.append(f"ignored unknown parts: {', '.join(unknown)}")

    medium_label = "Tamil medium" if medium == "ta" else "English medium"
    kind = "Marking scheme" if is_scheme else "Question paper"
    title = f"{year} A/L Combined Mathematics – {COVERAGE_LABEL[coverage]} – {kind} – {medium_label}"
    canonical = f"{year}_combinedmaths_{coverage}_{'TM' if medium == 'ta' else 'EM'}{'_Msch' if is_scheme else ''}.pdf"

    return ParsedPaperName(
        exam_year=year, language=medium,
        upload_type="marking_scheme" if is_scheme else "past_paper",
        paper_coverage=coverage, title=title, canonical_name=canonical, warnings=warnings,
    )
