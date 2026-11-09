"""Quiz generator tests: in-memory Qdrant + scripted LLM, no network."""
import random
import threading
from types import SimpleNamespace as NS

import pytest

from app.rag.embeddings import FakeEmbedder
from app.rag.ingestion import index_upload
from app.rag.quiz import NoQuestionsIndexed, QuizGenerator, QuizIncomplete, is_too_close, parse_quiz, pick_examples
from app.rag.retrieval import Retriever
from app.rag.types import AccessScope, UploadRecord
from app.rag.vector_store import VectorStore

PAPER = """Combined Mathematics I
PART A
1. Using the Principle of Mathematical Induction, prove that the sum of r(r+1) from r=1 to n equals n(n+1)(n+2)/3.
2. Sketch the graphs of y=|x|+1 and y=2|x-1| in the same diagram. Hence solve |x|+1 > 2|x-1|.
PART B
11. (a) Let alpha and beta be the roots of x^2 + bx + c = 0.
"""

STUDENT = AccessScope(10)


class ScriptedLLM:
    """Answers call n with texts[n]; the last text repeats. Calls run in threads, hence the lock."""
    def __init__(self, *texts):
        self.texts = list(texts) or [""]
        self.calls = []
        self.lock = threading.Lock()

    def create(self, **kw):
        with self.lock:
            self.calls.append(kw)
            text = self.texts[min(len(self.calls), len(self.texts)) - 1]
        return NS(content=[NS(type="text", text=text)], stop_reason="end_turn",
                  usage=NS(input_tokens=100, output_tokens=50))


STEPS = "\n".join(f"STEP {n}: step {n}\nRIGHT: $r{n}$\nWHY: ok\nWRONG: $w{n}$\nWHY: slip" for n in (1, 2, 3))


def _reply(*questions, steps=True):
    return "\n\n".join(f"=== Q{i}\nTOPIC: t{i}\nQUESTION:\n{q}\n{STEPS if steps else ''}\nANSWER:\n$x = {i}$"
                       for i, q in enumerate(questions, start=1))


class FlakyLLM(ScriptedLLM):
    """Fails the first `failures` calls; answers the rest."""
    def __init__(self, text, failures):
        super().__init__(text)
        self.failures = failures

    def create(self, **kw):
        with self.lock:
            fail, self.failures = self.failures > 0, self.failures - 1
        if fail:
            raise RuntimeError("OpenRouter 429: rate-limited")
        return super().create(**kw)


@pytest.fixture()
def retriever():
    emb = FakeEmbedder(64)
    store = VectorStore.from_url(":memory:", None, "quiz_chunks", emb.dim)
    store.ensure_collection()
    for year, uid in ((2016, 1), (2019, 2)):
        index_upload(UploadRecord(uid, 1, "past_paper", "global", "en", f"{year} Paper I", year, PAPER),
                     store, emb)
    index_upload(UploadRecord(3, 99, "past_paper", "private", "en", "Someone else's", 2020, PAPER), store, emb)
    return Retriever(store, emb)


def test_list_questions_returns_part_a_only_and_respects_scope(retriever):
    hits = retriever.list_questions(STUDENT, paper="I", paper_part="A")
    assert {(h.exam_year, h.question_number) for h in hits} == {(2016, "1"), (2016, "2"), (2019, "1"), (2019, "2")}


def test_pick_examples_takes_one_per_slot_in_order(retriever):
    pool = retriever.list_questions(STUDENT, paper="I", paper_part="A")
    picked = pick_examples(pool, 2, random.Random(0))
    assert [h.question_number for h in picked] == ["1", "2"]


def test_pick_examples_reuses_slots_with_a_different_year(retriever):
    pool = retriever.list_questions(STUDENT, paper="I", paper_part="A")
    picked = pick_examples(pool, 4, random.Random(0))
    assert [h.question_number for h in picked] == ["1", "2", "1", "2"]
    assert picked[0].exam_year != picked[2].exam_year


def test_parse_keeps_latex_backslashes():
    [(slot, topic, q, a, steps)] = parse_quiz("=== Q1\nTOPIC: Limits\nQUESTION:\nFind $\\frac{\\sin\\theta}{\\theta}$.\nANSWER:\n$1$")
    assert (slot, topic, a, steps) == (1, "Limits", "$1$", [])
    assert "\\frac" in q and "\\theta" in q


STEPPED = """=== Q1
TOPIC: Differentiation
QUESTION:
Find the stationary point of $y = x^{2} - 4x + 7$.
STEP 1: Differentiate
RIGHT: $\\dfrac{dy}{dx} = 2x - 4$
WHY: Power rule on each term; the constant vanishes.
WRONG: $\\dfrac{dy}{dx} = 2x - 4 + 7$
WHY: The derivative of a constant is $0$.
WRONG: $\\dfrac{dy}{dx} = x - 4$
WHY: Dropped the power 2 when differentiating $x^{2}$.
WRONG: $\\dfrac{dy}{dx} = 2x + 4$
WHY: Sign error on $-4x$.
STEP 2: Set the derivative to zero
RIGHT: $$\\begin{aligned} 2x - 4 &= 0 \\\\
x &= 2 \\end{aligned}$$
WHY: Stationary points have zero gradient.
WRONG: $x = -2$
WHY: Moved $-4$ across without changing its sign.
WRONG: $x = -2$
WHY: duplicate
WRONG: $x = 4$
WHY: Forgot to divide by 2.
STEP 3: Find y
RIGHT: $(2,\\ 3)$
WHY: $y = 4 - 8 + 7 = 3$.
WRONG: $(2,\\ 19)$
WHY: Used $+8$ instead of $-8$.
ANSWER:
$(2,\\ 3)$"""


def test_parse_steps_keeps_right_option_first_and_explanations():
    [(_, _, q, answer, steps)] = parse_quiz(STEPPED)
    assert q == "Find the stationary point of $y = x^{2} - 4x + 7$." and answer == "$(2,\\ 3)$"
    assert [s.title for s in steps] == ["Differentiate", "Set the derivative to zero", "Find y"]
    first = steps[0].options
    assert first[0].correct and first[0].text == "$\\dfrac{dy}{dx} = 2x - 4$"
    assert [o.correct for o in first] == [True, False, False, False]
    assert first[1].why == "The derivative of a constant is $0$."


def test_parse_steps_joins_multiline_maths_and_drops_duplicate_wrong_options():
    [(*_, steps)] = parse_quiz(STEPPED)
    right = steps[1].options[0]
    assert "\\begin{aligned}" in right.text and "\\end{aligned}$$" in right.text
    assert right.why == "Stationary points have zero gradient."
    assert [o.text for o in steps[1].options[1:]] == ["$x = -2$", "$x = 4$"]


def test_question_with_a_broken_step_falls_back_to_no_steps():
    broken = STEPPED.replace("RIGHT: $(2,\\ 3)$", "WRONG: $(3,\\ 2)$")   # step 3 loses its RIGHT option
    [(*_, steps)] = parse_quiz(broken)
    assert steps == []


def test_generate_returns_new_questions_with_style_source(retriever):
    llm = ScriptedLLM(_reply("Prove by induction that $\\sum_{r=1}^{n} (2r-1) = n^2$."),
                      _reply("Sketch $y=|x-2|$ and $y=3-|x|$. Hence solve $|x-2| < 3-|x|$."))
    quiz = QuizGenerator(llm, retriever, "test-model", rng=random.Random(1)).generate(
        scope=STUDENT, language="en", count=2)
    assert [q.number for q in quiz.questions] == [1, 2]
    assert quiz.questions[0].modelled_on["question_number"] == "1"
    assert quiz.tokens_used == 300 and quiz.dropped == 0 and quiz.incomplete == 0
    assert [len(s.options) for s in quiz.questions[0].steps] == [2, 2, 2]
    assert "<example>" in llm.calls[0]["messages"][0]["content"]
    assert "tools" not in llm.calls[0]


def test_quiz_is_written_one_question_per_parallel_call(retriever):
    llm = ScriptedLLM(_reply("Solve $x + 1 = 2$."))
    quiz = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate(scope=STUDENT, language="en", count=4)
    assert len(llm.calls) == 4
    assert "Write 1 new question," in llm.calls[0]["messages"][0]["content"]
    assert [q.number for q in quiz.questions] == [1, 2, 3, 4]
    assert quiz.tokens_used == 600


def test_stepless_question_is_asked_again_once(retriever):
    """Practice is step-by-step only: a question written without usable steps is re-asked once."""
    llm = ScriptedLLM(_reply("Solve $x - 1 = 2$.", steps=False), _reply("Solve $x + 1 = 2$."))
    quiz = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate(scope=STUDENT, language="en", count=1)
    assert len(llm.calls) == 2
    assert [q.question for q in quiz.questions] == ["Solve $x + 1 = 2$."] and quiz.incomplete == 0


def test_question_still_stepless_after_the_retry_is_left_out(retriever):
    llm = ScriptedLLM(_reply("Solve $x - 1 = 2$.", steps=False))
    quiz = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate(scope=STUDENT, language="en", count=1)
    assert len(llm.calls) == 2                      # first try + one retry, then give up
    assert quiz.questions == [] and quiz.incomplete == 1


def test_one_failed_call_is_retried_and_does_not_sink_the_quiz(retriever):
    llm = FlakyLLM(_reply("Solve $x + 1 = 2$."), failures=1)
    quiz = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate(scope=STUDENT, language="en", count=4)
    assert len(llm.calls) == 4                      # answered calls: 3 first time + the retried one
    assert [q.number for q in quiz.questions] == [1, 2, 3, 4] and quiz.incomplete == 0


def test_every_batch_failing_raises(retriever):
    gen = QuizGenerator(FlakyLLM("", failures=99), retriever, "m")
    with pytest.raises(RuntimeError):
        gen.generate(scope=STUDENT, language="en", count=2)


def test_no_indexed_questions_raises(retriever):
    gen = QuizGenerator(ScriptedLLM(""), retriever, "m")
    with pytest.raises(NoQuestionsIndexed):
        gen.generate(scope=STUDENT, language="en", paper="II")


def test_same_wording_with_new_numbers_is_not_a_copy():
    original = "1. Using the Principle of Mathematical Induction, prove that $\\sum r(r+1) = \\frac{n}{3}(n+1)(n+2)$."
    new = "Using the Principle of Mathematical Induction, prove that $\\sum r(r+2) = \\frac{n}{6}(n+1)(2n+7)$."
    assert not is_too_close(new, original)
    assert is_too_close(original[3:], original)


def test_verbatim_copy_of_a_past_question_is_dropped(retriever):
    copied = "Using the Principle of Mathematical Induction, prove that the sum of r(r+1) from r=1 to n equals n(n+1)(n+2)/3."
    llm = ScriptedLLM(_reply(copied), _reply("Solve $|2x-1| \\le 5$."))   # the copy is dropped, then re-asked
    quiz = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate(scope=STUDENT, language="en", count=1)
    assert quiz.dropped == 1
    assert [q.question for q in quiz.questions] == ["Solve $|2x-1| \\le 5$."]


def test_generate_one_models_the_requested_slot(retriever):
    llm = ScriptedLLM(_reply("Solve $|x - 3| < 2$."))
    q = QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate_one(scope=STUDENT, language="en", slot=2)
    assert q.number == 2 and q.modelled_on["question_number"] == "2" and len(q.steps) == 3
    assert "Write 1 new question," in llm.calls[0]["messages"][0]["content"]


def test_generate_one_retries_once_then_gives_up(retriever):
    llm = ScriptedLLM(_reply("Solve $x = 1$.", steps=False))
    with pytest.raises(QuizIncomplete):
        QuizGenerator(llm, retriever, "m", rng=random.Random(1)).generate_one(scope=STUDENT, language="en", slot=1)
    assert len(llm.calls) == 2


def test_generate_one_falls_back_to_any_slot_when_not_indexed(retriever):
    q = QuizGenerator(ScriptedLLM(_reply("Solve $x = 1$.")), retriever, "m", rng=random.Random(1)).generate_one(
        scope=STUDENT, language="en", slot=9)          # the fixture paper only has Q1 and Q2
    assert q.number == 9 and q.modelled_on["question_number"] in ("1", "2")


def test_options_do_not_give_away_their_verdict():
    from app.rag.quiz import strip_verdict
    w = r"For \(n=1\), LHS \(= \frac{1}{4}\), RHS \(= \frac{1}{3}\). LHS \(\neq\) RHS, so the statement fails."
    assert strip_verdict(w) == r"For \(n=1\), LHS \(= \frac{1}{4}\), RHS \(= \frac{1}{3}\)."
    assert strip_verdict(r"RHS $= \dfrac{1}{3}$. So LHS = RHS.") == r"RHS $= \dfrac{1}{3}$."
    keep = r"$x^{2} - 4x + 3 = 0 \Rightarrow x = 1$ or $x = 3$"
    assert strip_verdict(keep) == keep                      # ordinary working is untouched


def test_commentary_in_an_option_rejects_the_step():
    leaky = STEPPED.replace("WRONG: $x = 4$", "WRONG: $x = 4$, but the student forgets to divide")
    [(*_, steps)] = parse_quiz(leaky)
    assert steps == []                                      # step 2 unusable -> question re-asked
