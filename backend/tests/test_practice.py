"""Practice: pick a subject, get 5 new questions, nothing stored but the student's marks."""
import random
from types import SimpleNamespace as NS

import pytest
from qdrant_client import models as qm

from app.api.v1.endpoints import tutor
from app.core.dependencies import get_current_user
from app.main import app
from app.rag.embeddings import FakeEmbedder
from app.rag.quiz import LEVELS, PRACTICE_SIZE, QuizGenerator, QuizIncomplete, QuizQuestion, QuizStep, StepOption
from app.rag.types import AccessScope, Chunk, SearchHit, UploadRecord
from app.rag.vector_store import VectorStore
from app.services.topic_tags import tag_chunks
from app.services.topics import TOPICS, by_key, classify
from tests.test_admin_roles import login
from tests.test_auth_login import register

STEPS = [QuizStep(f"step {n}", [StepOption("$r$", "ok", True), StepOption("$w$", "slip", False)]) for n in (1, 2, 3)]
URL = "/api/v1/tutor/quiz/question"


class FakeGenerator:
    model = "test-model"

    def __init__(self):
        self.calls = []

    def generate_for_topic(self, *, scope, language, slot, topic, level=None):
        self.calls.append((scope.include_private, language, topic.key, slot, level))
        return QuizQuestion(slot, topic.en, f"New {topic.key} question", "$1$", {}, STEPS)


@pytest.fixture
def generator(client):
    gen = FakeGenerator()
    app.dependency_overrides[get_current_user] = lambda: NS(id=7, role=NS(value="student"))
    app.dependency_overrides[tutor.get_quiz_generator] = lambda: gen
    return gen


def test_a_quiz_is_five_questions():
    assert PRACTICE_SIZE == 5


def test_a_question_needs_login(client):
    assert client.post(URL, json={"slot": 1, "topic": "limits"}).status_code == 401


def test_a_question_is_written_on_the_subject(client, generator):
    q = client.post(URL, json={"lang": "en", "slot": 3, "topic": "friction"}).json()["question"]
    assert (q["number"], q["topic"]) == (3, "Friction") and q["steps"]
    assert generator.calls == [(False, "en", "friction", 3, 3)]          # global library, level 3 of 5


@pytest.mark.parametrize("body", [{"slot": 6, "topic": "limits"}, {"slot": 0, "topic": "limits"}, {"slot": 1}])
def test_bad_requests_are_refused(client, generator, body):
    assert client.post(URL, json=body).status_code == 422


def test_an_unknown_subject_is_refused(client, generator):
    assert client.post(URL, json={"slot": 1, "topic": "nope"}).status_code == 422


def test_an_unusable_question_is_a_clear_error(client, generator):
    def fail(**_):
        raise QuizIncomplete("no")
    generator.generate_for_topic = fail
    resp = client.post(URL, json={"slot": 1, "topic": "limits"})
    assert resp.status_code == 502 and resp.json()["detail"]["code"] == "quiz_failed"


def test_subjects_show_the_students_score(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")
    client.post("/api/v1/progress/attempts", json={"set_id": 1, "lang": "en", "answers": [
        {"slot": 1, "topic": "Limits", "steps_total": 4, "steps_right": 3}]})
    subjects = client.get("/api/v1/quizzes/subjects").json()["subjects"]
    assert len(subjects) == len(TOPICS)
    limits = next(s for s in subjects if s["key"] == "limits")
    assert (limits["pct"], limits["questions"], limits["strand"]) == (75, 1, "pure")
    assert next(s for s in subjects if s["key"] == "friction")["pct"] is None


def test_subjects_need_login(client):
    assert client.get("/api/v1/quizzes/subjects").status_code == 401


def test_every_topic_name_classifies_as_itself():
    # Marks are filed by these names, so a mismatch would credit another subject.
    assert all(classify(t.en) is t and classify(t.ta) is t for t in TOPICS)


def test_topic_ids_are_unique():
    # They are stored in Qdrant and the database, so a clash would mix two topics up.
    assert len({t.id for t in TOPICS}) == len(TOPICS)


class FakeRetriever:
    def __init__(self, hits, tagged=()):
        self.hits, self.tagged, self.asked = hits, list(tagged), None

    def by_topic(self, scope, topic_id, upload_types):
        return self.tagged

    def search(self, scope, query, **kw):
        self.asked = (query, kw["upload_types"])
        return self.hits


class FakeLLM:
    def __init__(self):
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        text = ("=== Q1\nTOPIC: Something the model made up\nQUESTION:\nA new question\n"
                + "".join(f"STEP {n}: s\nRIGHT: $r{n}$\nWHY: y\nWRONG: $w{n}$\nWHY: y\n" for n in (1, 2, 3))
                + "ANSWER:\n$1$\n")
        return NS(content=[NS(type="text", text=text)], usage=None)


def _hit(question_number, text="Example"):
    return SearchHit(text, 0.5, 1, "marking_scheme", "global", "en", "t", 2022, 1, "II", "A", question_number)


def test_generator_labels_the_question_with_the_subject():
    llm, retriever = FakeLLM(), FakeRetriever([_hit("3")])
    gen = QuizGenerator(llm, retriever, "m", rng=random.Random(0))
    q = gen.generate_for_topic(scope=AccessScope(1), language="ta", slot=4, topic=by_key("friction"))
    assert (q.number, q.topic) == (4, by_key("friction").ta)             # the list's name, not the model's
    assert "Friction" in llm.calls[0]["messages"][0]["content"]
    assert "Paper II (Applied Mathematics)" in llm.calls[0]["system"]


@pytest.mark.parametrize("level, word", [(1, "very easy"), (5, "very hard")])
def test_questions_climb_in_difficulty(level, word):
    llm = FakeLLM()
    QuizGenerator(llm, FakeRetriever([_hit("3")]), "m", rng=random.Random(0)).generate_for_topic(
        scope=AccessScope(1), language="en", slot=level, topic=by_key("limits"), level=level)
    assert word in llm.calls[0]["messages"][0]["content"]


def test_admin_drafts_keep_the_examples_difficulty():
    llm = FakeLLM()
    QuizGenerator(llm, FakeRetriever([_hit("3")]), "m", rng=random.Random(0)).generate_for_topic(
        scope=AccessScope(1), language="en", slot=1, topic=by_key("limits"))
    assert "Difficulty" not in llm.calls[0]["messages"][0]["content"]


def test_there_is_a_level_for_every_question():
    assert len(LEVELS) == PRACTICE_SIZE


def test_generator_prefers_real_questions_as_examples():
    gen = QuizGenerator(FakeLLM(), FakeRetriever([_hit(None, "cover page"), _hit("7", "a question")]), "m")
    assert [h.text for h in gen._topic_pool(AccessScope(1), by_key("limits"))] == ["a question"]


def test_tagged_chunks_are_used_before_searching():
    retriever = FakeRetriever([_hit("7", "search result")], tagged=[_hit("2", "tagged chunk")])
    pool = QuizGenerator(FakeLLM(), retriever, "m")._topic_pool(AccessScope(1), by_key("limits"))
    assert [h.text for h in pool] == ["tagged chunk"] and retriever.asked is None


def _store():
    embedder = FakeEmbedder(32)
    store = VectorStore.from_url(":memory:", None, "tags", embedder.dim)
    store.ensure_collection()

    def index(upload_id, visibility, upload_type, text, paper=None):
        rec = UploadRecord(upload_id, 0, upload_type, visibility, "en", "t", 2022, text)
        store.upsert_chunks(rec, [Chunk(upload_id, 0, text, paper=paper)], embedder.embed_documents([text]))

    return store, embedder, index


def _tags(store):
    return {p["upload_id"]: p["topic_ids"] for p in store.scroll_payloads(qm.Filter())}


def test_tagging_covers_the_library_only_and_can_run_again():
    store, embedder, index = _store()
    index(1, "global", "marking_scheme", "Friction")
    index(2, "private", "past_paper", "Friction")
    assert tag_chunks(store, embedder, min_score=0.5)[by_key("friction").id] == 1
    tagged = _tags(store)
    assert by_key("friction").id in tagged[1] and tagged[2] == []
    tag_chunks(store, embedder, min_score=0.5)
    assert _tags(store) == tagged


def test_tagging_keeps_pure_and_applied_on_their_own_papers():
    store, embedder, index = _store()
    index(1, "global", "marking_scheme", "Friction", paper="I")
    index(2, "global", "marking_scheme", "Friction", paper="II")
    index(3, "global", "marking_scheme", "Friction")
    tag_chunks(store, embedder, min_score=0.5)
    tagged, friction = _tags(store), by_key("friction").id                # an Applied topic
    assert friction not in tagged[1] and friction in tagged[2] and friction in tagged[3]


def _student(client):
    register(client, "kavin@example.com")
    login(client, "kavin@example.com")


def _subject(client, key):
    return next(s for s in client.get("/api/v1/quizzes/subjects").json()["subjects"] if s["key"] == key)


def _quiz(client, set_id, answers):
    client.post("/api/v1/progress/attempts", json={"set_id": set_id, "lang": "en", "answers": answers})


def _answer(slot, topic, right):
    return {"slot": slot, "topic": topic, "steps_total": 3, "steps_right": right}


def test_each_quiz_on_a_subject_is_one_attempt_newest_first(client):
    _student(client)
    _quiz(client, 1, [_answer(n, "Limits", 3) for n in range(1, 6)])
    _quiz(client, 2, [_answer(n, "Limits", 1) for n in range(1, 6)])
    limits = _subject(client, "limits")
    assert limits["quizzes"] == 2 and len(limits["attempts"]) == 2
    assert {a["set_id"]: (a["perfect"], a["questions"], a["pct"]) for a in limits["attempts"]} == {
        1: (5, 5, 100), 2: (0, 5, 33)}


def test_a_whole_syllabus_quiz_adds_to_the_score_but_not_the_history(client):
    _student(client)
    _quiz(client, 1, [_answer(1, "Limits", 3), _answer(2, "Friction", 3)])
    limits = _subject(client, "limits")
    assert limits["pct"] == 100 and limits["quizzes"] == 0 and limits["attempts"] == []


def test_another_students_history_is_not_shown(client):
    _student(client)
    _quiz(client, 1, [_answer(1, "Limits", 3)])
    register(client, "other@example.com")
    login(client, "other@example.com")
    assert _subject(client, "limits")["quizzes"] == 0
