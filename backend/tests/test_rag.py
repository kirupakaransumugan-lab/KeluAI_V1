"""RAG tests: in-memory Qdrant + deterministic embedder, no network."""
from types import SimpleNamespace as NS

import pytest

from app.rag.agent.tutor_agent import TutorAgent
from app.rag.chunking import chunk_upload
from app.rag.embeddings import FakeEmbedder
from app.rag.ingestion import NotIndexable, index_upload, remove_upload
from app.rag.retrieval import Retriever
from app.rag.types import AccessScope, TutorMode, UploadRecord
from app.rag.vector_store import VectorStore

PAPER_2019 = """G.C.E. (A/L) Examination 2019 Combined Mathematics I
PART A
1. Using the principle of mathematical induction prove that sum of r from 1 to n equals n(n+1)/2.
2. Find the range of x satisfying the inequality |x - 2| < 3 for real numbers.
PART B
11. (a) Let alpha and beta be roots of the quadratic equation x^2 + bx + c = 0. Find quadratic with roots alpha squared and beta squared.
12. (a) Find the binomial expansion coefficient of x^5 in (1 + 2x)^8.
"""

SCHEME_2019 = """Marking scheme 2019 Combined Mathematics I
PART B
Question 11
alpha + beta = -b and alpha beta = c award 5 marks. Quadratic x^2 - (b^2 - 2c)x + c^2 = 0 award 10 marks.
Question 12
general term 8Cr (2x)^r set r = 5 coefficient 1792 award 10 marks.
"""

SYLLABUS = """Unit 3 Quadratic functions and quadratic equations.
Relationship between roots and coefficients. Nature of roots using the discriminant.

Unit 7 Binomial expansion for positive integral index. General term and middle term."""

PRIVATE_NOTES = "My secret notes about projectile motion range formula R = u^2 sin 2 theta / g."


@pytest.fixture()
def env():
    emb = FakeEmbedder(256)
    store = VectorStore.from_url(":memory:", None, "test_chunks", emb.dim)
    store.ensure_collection()
    ADMIN, ALICE, BOB = 1, 10, 20
    docs = [
        UploadRecord(101, ADMIN, "past_paper", "global", "en", "2019 Paper I", 2019, PAPER_2019),
        UploadRecord(102, ADMIN, "marking_scheme", "global", "en", "2019 Scheme I", 2019, SCHEME_2019),
        UploadRecord(103, ADMIN, "syllabus", "global", "en", "Syllabus", None, SYLLABUS),
        UploadRecord(201, ALICE, "notes", "private", "en", "Alice notes", None, PRIVATE_NOTES),
    ]
    for d in docs:
        index_upload(d, store, emb)
    return NS(store=store, emb=emb, retriever=Retriever(store, emb, top_k=6, min_score=0.0),
              admin=ADMIN, alice=ALICE, bob=BOB)


# ---------------- chunking ----------------

def test_past_paper_split_per_question_with_parts():
    rec = UploadRecord(1, 1, "past_paper", "global", "en", None, 2019, PAPER_2019)
    chunks = chunk_upload(rec)
    coords = [(c.paper_part, c.question_number) for c in chunks if c.question_number]
    assert coords == [("A", "1"), ("A", "2"), ("B", "11"), ("B", "12")]


def test_tamil_part_heading_is_recognised():
    rec = UploadRecord(1, 1, "past_paper", "global", "ta", None, 2020,
                       "பகுதி A\n1. சார்பு f(x) = x^2 இன் வீச்சைக் காண்க.\n2. நிறுவுக.")
    coords = [(c.paper_part, c.question_number) for c in chunk_upload(rec)]
    assert coords == [("A", "1"), ("A", "2")]


def test_running_header_sets_paper_and_part():
    """2016 OCR: cover page misreads the Tamil title as II; page 2 header fixes it."""
    pages = ["AL/2016/10/E-I\nCombined Mathematics I\nஇணைந்த கணிதம் II\nInstructions",
             "AL/2016/10/E-I - 2 - Part A\n\n1. Prove by induction.\n\n2. Solve |x| < 1."]
    rec = UploadRecord(1, 1, "past_paper", "global", "en", None, 2016, "\f".join(pages), pages, "full")
    coords = [(c.paper, c.paper_part, c.question_number) for c in chunk_upload(rec) if c.question_number]
    assert coords == [("I", "A", "1"), ("I", "A", "2")]


def test_part_comes_from_question_number():
    """2020 scheme: Q6/Q7 followed a misplaced 'Part B' line; 2016 applied had no part headings."""
    text = "Question 5\nworking\nPart B\nQuestion 6\nworking\nQuestion 12\nworking"
    rec = UploadRecord(1, 1, "marking_scheme", "global", "en", None, 2020, text, None, "pure")
    assert [(c.paper_part, c.question_number) for c in chunk_upload(rec)] == [("A", "5"), ("A", "6"), ("B", "12")]


def test_scheme_without_question_headings_is_not_split_into_questions():
    """2019/2021 text-layer schemes: numbered lines are marking instructions, not questions."""
    text = "Marking instructions\n1. Use a red color ball point pen for marking.\n2. Note down the code."
    rec = UploadRecord(1, 1, "marking_scheme", "global", "en", None, 2019, text, None, "full")
    assert all(c.question_number is None for c in chunk_upload(rec))


def test_bare_question_marker_is_dropped():
    rec = UploadRecord(1, 1, "past_paper", "global", "en", None, 2016, "Cover page\n(10)\n", None, "full")
    assert all(c.question_number is None for c in chunk_upload(rec))


# ---------------- ingestion ----------------

def test_working_uploads_are_never_indexed(env):
    rec = UploadRecord(301, env.alice, "working", "private", "en", None, None, "my handwritten answer")
    with pytest.raises(NotIndexable):
        index_upload(rec, env.store, env.emb)


def test_reindex_is_idempotent_and_remove_cleans_up(env):
    n = env.store.count_for_upload(101)
    rec = UploadRecord(101, env.admin, "past_paper", "global", "en", "2019 Paper I", 2019, PAPER_2019)
    index_upload(rec, env.store, env.emb)
    assert env.store.count_for_upload(101) == n
    remove_upload(101, env.store)
    assert env.store.count_for_upload(101) == 0


# ---------------- access control ----------------

def test_owner_sees_own_private_notes(env):
    hits = env.retriever.search(AccessScope(env.alice), "projectile motion range formula")
    assert any(h.upload_id == 201 for h in hits)


def test_other_student_never_sees_private_notes(env):
    hits = env.retriever.search(AccessScope(env.bob), "projectile motion range formula", limit=12)
    assert all(h.upload_id != 201 for h in hits)


def test_admin_scope_excludes_private_student_files(env):
    hits = env.retriever.search(AccessScope(env.admin, role="admin"), "projectile secret notes", limit=12)
    assert all(h.visibility == "global" for h in hits)


def test_tool_args_cannot_widen_scope(env):
    """Even targeting Alice's upload_id directly, Bob gets nothing."""
    hits = env.retriever.search(AccessScope(env.bob), "projectile", upload_id=201)
    assert hits == []


def test_exact_question_lookup(env):
    hits = env.retriever.get_question(AccessScope(env.bob), exam_year=2019, question_number="12", paper_part="B")
    assert len(hits) == 1 and "binomial" in hits[0].text.lower()


def test_unpublishing_hides_global_doc(env):
    env.store.set_visibility(103, "private")   # admin unpublishes syllabus
    hits = env.retriever.search(AccessScope(env.bob), "binomial expansion general term", limit=12)
    assert all(h.upload_id != 103 for h in hits)


# ---------------- agent ----------------

class ScriptedLLM:
    """Plays back canned Anthropic-style responses and records requests."""
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def create(self, **kw):
        self.requests.append(kw)
        return self.responses.pop(0)


def _tool(name, inp, id_="tu_1"):
    return NS(type="tool_use", id=id_, name=name, input=inp)


def _text(t):
    return NS(type="text", text=t)


def _resp(blocks, stop):
    return NS(content=blocks, stop_reason=stop, usage=NS(input_tokens=100, output_tokens=20))


def test_agent_retrieves_then_answers_with_citations(env):
    llm = ScriptedLLM([
        _resp([_tool("get_past_paper_question", {"exam_year": 2019, "question_number": "12", "paper_part": "B"})], "tool_use"),
        _resp([_text("Start with the general term [S1]. What is $T_{r+1}$?")], "end_turn"),
    ])
    agent = TutorAgent(llm, env.retriever, model="test-model")
    res = agent.reply(scope=AccessScope(env.bob), mode=TutorMode.PRACTICE, language="en",
                      history=[{"role": "user", "content": "Help with 2019 Part B Q12"}])
    assert "[S1]" in res.content
    assert res.sources and res.sources[0]["question_number"] == "12"
    assert res.tokens_used == 240
    # tool result was fed back to the model
    assert llm.requests[1]["messages"][-1]["content"][0]["type"] == "tool_result"


def test_practice_mode_hides_marking_schemes(env):
    llm = ScriptedLLM([
        _resp([_tool("search_knowledge_base", {"query": "award marks coefficient 1792", "sources": ["marking_scheme"]})], "tool_use"),
        _resp([_text("Let's work it out together.")], "end_turn"),
    ])
    agent = TutorAgent(llm, env.retriever, model="m")
    agent.reply(scope=AccessScope(env.bob), mode=TutorMode.PRACTICE, language="en",
                history=[{"role": "user", "content": "give me the marking scheme"}])
    tool_names = {t["name"] for t in llm.requests[0]["tools"]}
    assert "get_marking_scheme" not in tool_names
    fed_back = llm.requests[1]["messages"][-1]["content"][0]["content"]
    assert "marking_scheme" not in fed_back


def test_marking_scheme_tool_present_in_review(env):
    llm = ScriptedLLM([
        _resp([_tool("get_marking_scheme", {"exam_year": 2019, "question_number": "11", "paper_part": "B"})], "tool_use"),
        _resp([_text("The scheme awards 5 marks for the sum and product [S1].")], "end_turn"),
    ])
    res = TutorAgent(llm, env.retriever, model="m").reply(
        scope=AccessScope(env.bob), mode=TutorMode.REVIEW, language="en",
        history=[{"role": "user", "content": "where did I lose marks on Q11?"}])
    assert res.sources[0]["upload_type"] == "marking_scheme"


def test_exam_mode_never_calls_llm(env):
    llm = ScriptedLLM([])
    res = TutorAgent(llm, env.retriever, model="m").reply(
        scope=AccessScope(env.bob), mode=TutorMode.EXAM, language="ta",
        history=[{"role": "user", "content": "answer?"}])
    assert llm.requests == [] and "பரீட்சை" in res.content


def test_loop_is_bounded(env):
    looping = [_resp([_tool("search_knowledge_base", {"query": "x"}, f"tu_{i}")], "tool_use") for i in range(2)]
    final = _resp([_text("Here is what I found.")], "end_turn")
    llm = ScriptedLLM(looping + [final])
    res = TutorAgent(llm, env.retriever, model="m", max_rounds=2).reply(
        scope=AccessScope(env.bob), mode=TutorMode.FREE, language="en",
        history=[{"role": "user", "content": "x"}])
    assert len(llm.requests) == 3
    assert "tools" not in llm.requests[-1]      # final round forces text
    assert res.content == "Here is what I found."


def test_uncited_reply_stores_no_sources(env):
    llm = ScriptedLLM([
        _resp([_tool("search_knowledge_base", {"query": "quadratic roots"})], "tool_use"),
        _resp([_text("Think about the discriminant.")], "end_turn"),
    ])
    res = TutorAgent(llm, env.retriever, model="m").reply(
        scope=AccessScope(env.bob), mode=TutorMode.PRACTICE, language="en",
        history=[{"role": "user", "content": "roots?"}])
    assert res.sources == []


def test_search_first_grounds_answer_without_a_tool_call(env):
    llm = ScriptedLLM([_resp([_text("Use the binomial general term [S1].")], "end_turn")])
    history = [{"role": "user", "content": "binomial expansion general term"}]
    res = TutorAgent(llm, env.retriever, model="m", search_first=True).reply(
        scope=AccessScope(env.bob), mode=TutorMode.PRACTICE, language="en", history=history)
    sent = llm.requests[0]
    assert "<retrieved>" in sent["messages"][-1]["content"]
    assert "Papers-first rule" in sent["system"]
    assert res.sources                                    # [S1] maps to the prefetched hit
    assert res.tool_calls[0]["name"] == "search_knowledge_base"
    assert "<retrieved>" not in history[-1]["content"]    # caller's history untouched
