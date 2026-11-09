"""Tamil practice quizzes: Tamil style examples first, the Tamil model, and no garbled Tamil."""
import random
from types import SimpleNamespace as NS

from app.rag.quiz import QuizGenerator, in_language
from app.rag.types import AccessScope, SearchHit
from app.services.topics import by_key


def _hit(lang, text="Example", q="3"):
    return SearchHit(text, 0.5, 1, "marking_scheme", "global", lang, "t", 2022, 1, "I", "A", q)


def _quiz_text(question):
    return ("=== Q1\nTOPIC: t\nQUESTION:\n" + question + "\n"
            + "".join(f"STEP {n}: படி\nRIGHT: $r{n}$\nWHY: சரியானது\nWRONG: $w{n}$\nWHY: தவறு\n" for n in (1, 2, 3))
            + "ANSWER:\n$1$\n")


class FakeLLM:
    def __init__(self, *questions):
        self.questions, self.calls = list(questions), []

    def create(self, **kw):
        self.calls.append(kw)
        return NS(content=[NS(type="text", text=_quiz_text(self.questions.pop(0)))], usage=None)


class FakeRetriever:
    def __init__(self, tagged, by_name=()):
        self.tagged, self.by_name, self.searched = tagged, list(by_name), []

    def by_topic(self, scope, topic_id, upload_types):
        return self.tagged

    def search(self, scope, query, **kw):
        self.searched.append((query, kw.get("language")))
        return self.by_name


GOOD_TA = "$f(x) = x^2$ இன் பெறுதியைக் காண்க."
BAD_TA = "$f(x) = x^2$ இன் giả thuyết காண்க."


def test_examples_in_the_quiz_language_come_first():
    pool = [_hit("en", "english"), _hit("ta", "tamil")]
    assert [h.text for h in in_language(pool, "ta")] == ["tamil"]
    assert [h.text for h in in_language([_hit("en")], "ta")] == ["Example"]     # none in Tamil: use what there is


def test_a_tamil_quiz_copies_a_tamil_example_and_uses_the_tamil_model():
    llm = FakeLLM(GOOD_TA)
    gen = QuizGenerator(llm, FakeRetriever([_hit("en", "ENGLISH EXAMPLE"), _hit("ta", "TAMIL EXAMPLE")]),
                        "free-model", rng=random.Random(0), tamil_model="tamil-model")
    gen.generate_for_topic(scope=AccessScope(1), language="ta", slot=1, topic=by_key("limits"))
    prompt = llm.calls[0]["messages"][0]["content"]
    assert "TAMIL EXAMPLE" in prompt and "ENGLISH EXAMPLE" not in prompt
    assert llm.calls[0]["model"] == "tamil-model"
    assert "How to write Tamil" in llm.calls[0]["system"]


def test_tamil_chunks_are_searched_by_the_tamil_name_when_none_are_tagged():
    retriever = FakeRetriever([_hit("en")], by_name=[_hit("ta", "TAMIL EXAMPLE")])
    llm = FakeLLM(GOOD_TA)
    QuizGenerator(llm, retriever, "m", rng=random.Random(0)).generate_for_topic(
        scope=AccessScope(1), language="ta", slot=1, topic=by_key("limits"))
    assert (by_key("limits").ta, "ta") in retriever.searched
    assert "TAMIL EXAMPLE" in llm.calls[0]["messages"][0]["content"]


def test_a_garbled_tamil_question_is_rewritten():
    llm = FakeLLM(BAD_TA, GOOD_TA)
    q = QuizGenerator(llm, FakeRetriever([_hit("ta")]), "m", rng=random.Random(0)).generate_for_topic(
        scope=AccessScope(1), language="ta", slot=1, topic=by_key("limits"))
    assert q.question == GOOD_TA and len(llm.calls) == 2


def test_english_quizzes_are_unchanged():
    llm = FakeLLM("Find the derivative of $x^2$.")
    QuizGenerator(llm, FakeRetriever([_hit("en")]), "free-model", rng=random.Random(0),
                  tamil_model="tamil-model").generate_for_topic(
        scope=AccessScope(1), language="en", slot=1, topic=by_key("limits"))
    assert llm.calls[0]["model"] == "free-model"
    assert "How to write Tamil" not in llm.calls[0]["system"]
