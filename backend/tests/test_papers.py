"""Filename convention + full (Pure + Applied) Tamil-medium papers."""
from types import SimpleNamespace as NS

import pytest

from app.rag.agent.tools import ToolContext, run_tool
from app.rag.chunking import chunk_upload
from app.rag.embeddings import FakeEmbedder
from app.rag.filenames import FilenameError, parse_kb_filename
from app.rag.ingestion import index_upload
from app.rag.retrieval import Retriever, normalise_coordinates
from app.rag.types import AccessScope, TutorMode, UploadRecord
from app.rag.vector_store import VectorStore

# ---------------- filenames ----------------

@pytest.mark.parametrize("name,year,lang,kind,cov", [
    ("2019_combinedmaths_full_TM.pdf", 2019, "ta", "past_paper", "full"),
    ("2019 combinedmaths full TM Msch.pdf", 2019, "ta", "marking_scheme", "full"),
    ("2021-CombinedMaths-pure-EM.pdf", 2021, "en", "past_paper", "pure"),
    ("2018 Combined Maths Applied TM MSch.PDF", 2018, "ta", "marking_scheme", "applied"),
    ("C:\\papers\\2020_combinedmaths_full_tm_msch.pdf", 2020, "ta", "marking_scheme", "full"),
    ("2016 Combined Maths Full EN.pdf", 2016, "en", "past_paper", "full"),
    ("2016 Combined Maths Full TN MSch.pdf", 2016, "ta", "marking_scheme", "full"),
])
def test_parse_convention(name, year, lang, kind, cov):
    p = parse_kb_filename(name)
    assert (p.exam_year, p.language, p.upload_type, p.paper_coverage) == (year, lang, kind, cov)
    assert p.warnings == []


def test_title_and_canonical_name():
    p = parse_kb_filename("2019 combinedmaths full TM Msch.pdf")
    assert p.title == "2019 A/L Combined Mathematics – Full paper (Pure + Applied) – Marking scheme – Tamil medium"
    assert p.canonical_name == "2019_combinedmaths_full_TM_Msch.pdf"


def test_missing_parts_warn_or_fail():
    assert "assumed full" in parse_kb_filename("2019_combinedmaths_TM.pdf").warnings[0]
    with pytest.raises(FilenameError, match="medium"):
        parse_kb_filename("2019_combinedmaths_full.pdf")
    with pytest.raises(FilenameError, match="year"):
        parse_kb_filename("combinedmaths_full_TM.pdf")
    with pytest.raises(FilenameError, match="Sinhala"):
        parse_kb_filename("2019_combinedmaths_full_SM.pdf")


# ---------------- full Tamil-medium paper ----------------

FULL_TM = [
    # page 1 — Paper I (Pure)
    """க.பொ.த. (உ/த) பரீட்சை 2019
இணைந்த கணிதம் I
10 T I
பகுதி A
1. கணிதத் தொகுத்தறிவுக் கோட்பாட்டைப் பயன்படுத்தி நிறுவுக.
2. |x - 2| < 3 ஐத் திருப்தியாக்கும் x இன் வீச்சைக் காண்க.""",
    # page 2 — still Paper I; running header must not cut Q11
    """பகுதி B
11. (a) x^2 + bx + c = 0 இன் மூலங்கள் alpha, beta எனின் ...
இணைந்த கணிதம் I
(b) மேலும் alpha^2, beta^2 ஐ மூலங்களாகக் கொண்ட சமன்பாட்டைக் காண்க.
12. (1 + 2x)^8 இன் விரிவில் x^5 இன் குணகத்தைக் காண்க.""",
    # page 3 — Paper II (Applied) starts, numbering restarts
    """இணைந்த கணிதம் II
10 T II
பகுதி A
1. ஒரு துணிக்கை u வேகத்துடன் எறியப்படுகிறது. வீச்சு R ஐக் காண்க.
பகுதி B
12. ஒப்பமான சாய்தளத்தில் m திணிவுடைய துணிக்கையின் ஆர்முடுகலைக் காண்க.""",
]


def _rec(pages, coverage="full", upload_id=501, kind="past_paper"):
    return UploadRecord(upload_id, 1, kind, "global", "ta", "2019 TM", 2019,
                        "\f".join(pages), pages=pages, paper_coverage=coverage)


def test_full_paper_tracks_paper_part_and_question():
    coords = [(c.paper, c.paper_part, c.question_number, c.page)
              for c in chunk_upload(_rec(FULL_TM)) if c.question_number]
    assert coords == [
        ("I", "A", "1", 1), ("I", "A", "2", 1),
        ("I", "B", "11", 2), ("I", "B", "12", 2),
        ("II", "A", "1", 3), ("II", "B", "12", 3),
    ]


def test_running_header_does_not_split_question():
    q11 = [c for c in chunk_upload(_rec(FULL_TM)) if c.question_number == "11"]
    assert len(q11) == 1 and "(b)" in q11[0].text


def test_pure_only_file_defaults_to_paper_I():
    pages = ["பகுதி A\n1. நிறுவுக.\n2. காண்க."]
    assert {c.paper for c in chunk_upload(_rec(pages, coverage="pure"))} == {"I"}


def test_applied_only_file_defaults_to_paper_II():
    pages = ["PART B\n12. Find the acceleration of the particle on the smooth plane."]
    assert {c.paper for c in chunk_upload(_rec(pages, coverage="applied"))} == {"II"}


def test_transcribed_scheme_uses_question_headings_not_marks():
    # Text-layer marking schemes: "Question N" headings, marks "(5)" at line start,
    # Paper II announced only by the "10 – <subject> II" title (Tamil text mangled).
    pages = [
        "10 – Combined Mathematics I\nPart A\nQuestion 1\nFor n = 1 the result holds.\n(5)\n(10)\n"
        "Question 2\n(ii) sketch the graphs\n(5)",
        "10 – இைணந் த கணிதம் II\nபகுதி A\nவினா 1\nதிணிவு m\n(5)",
    ]
    got = [(c.paper, c.paper_part, c.question_number) for c in chunk_upload(_rec(pages, kind="marking_scheme"))]
    assert got == [("I", "A", "1"), ("I", "A", "2"), ("II", "A", "1")]


@pytest.mark.parametrize("paper,part,expected", [
    ("I", "B", ("I", "B")), (None, "II-B", ("II", "B")), ("pure", None, ("I", None)),
    ("2", "a", ("II", "A")), ("III", "C", (None, None)),
])
def test_normalise_coordinates(paper, part, expected):
    assert normalise_coordinates(paper, part) == expected


# ---------------- retrieval + agent tool ----------------

@pytest.fixture()
def env():
    emb = FakeEmbedder(256)
    store = VectorStore.from_url(":memory:", None, "papers", emb.dim)
    store.ensure_collection()
    index_upload(_rec(FULL_TM), store, emb)
    return NS(store=store, retriever=Retriever(store, emb, min_score=0.0))


def test_same_number_different_papers_are_separate(env):
    s = AccessScope(7)
    pure = env.retriever.get_question(s, exam_year=2019, question_number="12", paper="I")
    applied = env.retriever.get_question(s, exam_year=2019, question_number="12", paper="II")
    assert len(pure) == 1 and "குணகத்தை" in pure[0].text
    assert len(applied) == 1 and "சாய்தளத்தில்" in applied[0].text


def test_tool_asks_which_paper_when_ambiguous(env):
    ctx = ToolContext(AccessScope(7), TutorMode.PRACTICE, "ta")
    out = run_tool("get_past_paper_question", {"exam_year": 2019, "question_number": "12"}, ctx, env.retriever)
    assert out.startswith("AMBIGUOUS")
    out = run_tool("get_past_paper_question",
                   {"exam_year": 2019, "question_number": "12", "paper": "II"}, ctx, env.retriever)
    assert "Paper II (Applied)" in out and "சாய்தளத்தில்" in out
