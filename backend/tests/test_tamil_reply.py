"""Tamil tutor replies: spotting foreign words and broken letters, and the one repair pass."""
from types import SimpleNamespace as NS

from app.rag.agent.tutor_agent import TutorAgent
from app.rag.tamil_text import tamil_reply_problems
from app.rag.types import AccessScope, TutorMode
from tests.test_openrouter import _retriever

# Phrases from the reply a student reported (free model, default temperature).
BAD_VIETNAMESE = "தொகுத்தறிவு giả thuyết: $n = k$ என அனுமானிப்போம்."
BAD_ITALIAN = "எனவே இது 3 மூலம் வகுபடுகிறது. அதற்கொண்டு $n = 1$ இல் acertissima."
GOOD = ("முதலில் $n = 1$ இற்குப் பேறு உண்மையா எனப் பார்ப்போம். $1^3 + 5(1) = 6 = 3 \\times 2$. "
        "எனவே $n = 1$ இற்குப் பேறு உண்மையாகும் [S1]. இப்போது பெறுதி (derivative) காண்போம்.\n"
        "```graph\n{\"x\": [-1, 1], \"items\": [{\"fn\": \"x^2\", \"label\": \"curve\"}]}\n```")


def test_foreign_words_are_caught():
    assert "foreign" in tamil_reply_problems(BAD_VIETNAMESE)          # accented Latin letters
    assert "english" in tamil_reply_problems(BAD_ITALIAN)             # no accents, but one long Latin word


def test_the_english_ai_solved_disclaimer_is_allowed():
    assert tamil_reply_problems("AI-solved – this question was not found in your papers.\nமுதலில் பார்ப்போம்.") == []


def test_many_latin_words_in_tamil_prose_are_caught():
    text = "இது base case ஆகும். இப்போது inductive hypothesis எடுத்து prove செய்வோம்."
    assert "english" in tamil_reply_problems(text)


def test_broken_letters_are_caught():
    assert "broken" in tamil_reply_problems("இது ைக தவறு")      # vowel sign with no letter


def test_good_tamil_with_maths_graph_and_citation_passes():
    assert tamil_reply_problems(GOOD) == []


def test_times_sign_outside_latex_is_not_foreign():
    assert tamil_reply_problems("விடை 3 × 2 = 6 ஆகும்.") == []


# ---------- repair pass ----------

class FakeLLM:
    """Answers with the queued texts in order and records each request."""

    def __init__(self, *texts):
        self.texts, self.calls = list(texts), []

    def create(self, **kw):
        self.calls.append(kw)
        return NS(content=[NS(type="text", text=self.texts.pop(0))], stop_reason="end_turn",
                  usage=NS(input_tokens=10, output_tokens=5))


def _reply(llm, lang="ta"):
    agent = TutorAgent(llm, _retriever(), model="free-model", tamil_model="tamil-model")
    return agent.reply(scope=AccessScope(1), mode=TutorMode.PRACTICE, language=lang,
                       history=[{"role": "user", "content": "தொகுத்தறிவு"}])


def test_bad_tamil_is_rewritten_once():
    llm = FakeLLM(BAD_VIETNAMESE, GOOD)
    res = _reply(llm)
    assert res.content == GOOD and len(llm.calls) == 2
    assert "proofreading" in llm.calls[1]["system"]


def test_good_tamil_is_not_sent_again():
    llm = FakeLLM(GOOD)
    assert _reply(llm).content == GOOD and len(llm.calls) == 1


def test_a_rewrite_that_is_no_better_is_dropped():
    llm = FakeLLM(BAD_VIETNAMESE, "இன்னும் giả thuyết")
    assert _reply(llm).content == BAD_VIETNAMESE


def test_tamil_replies_use_the_tamil_model_and_english_does_not():
    llm = FakeLLM(GOOD)
    _reply(llm)
    assert llm.calls[0]["model"] == "tamil-model"
    llm = FakeLLM("Check $n = 1$ first.")
    _reply(llm, lang="en")
    assert llm.calls[0]["model"] == "free-model"
