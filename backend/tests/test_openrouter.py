"""OpenRouter adapter: Anthropic-shaped agent loop <-> OpenAI chat format, no network."""
import json

import httpx

from app.rag.agent.openrouter_llm import OpenRouterLLM
from app.rag.agent.tutor_agent import TutorAgent
from app.rag.embeddings import FakeEmbedder
from app.rag.ingestion import index_upload
from app.rag.retrieval import Retriever
from app.rag.types import AccessScope, TutorMode, UploadRecord
from app.rag.vector_store import VectorStore

PAPER = """Combined Mathematics I
PART B
12. (a) Find the binomial expansion coefficient of x^5 in (1 + 2x)^8.
"""


def _llm(responses, requests):
    def handler(req: httpx.Request) -> httpx.Response:
        requests.append(json.loads(req.content))
        return httpx.Response(200, json=responses.pop(0))
    llm = OpenRouterLLM("test-key")
    llm._http = httpx.Client(base_url="https://x", transport=httpx.MockTransport(handler))
    return llm


def _msg(content=None, tool_calls=None, finish="stop"):
    return {"choices": [{"message": {"role": "assistant", "content": content, "tool_calls": tool_calls},
                         "finish_reason": finish}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20}}


def _retriever():
    emb = FakeEmbedder(256)
    store = VectorStore.from_url(":memory:", None, "o", emb.dim)
    store.ensure_collection()
    index_upload(UploadRecord(1, 1, "past_paper", "global", "en", "2019 Paper I", 2019, PAPER), store, emb)
    return Retriever(store, emb, min_score=0.0)


def test_openrouter_tool_round_trip():
    call = {"id": "call_1", "type": "function", "function": {
        "name": "get_past_paper_question",
        "arguments": json.dumps({"exam_year": 2019, "question_number": "12", "paper": "I"})}}
    requests: list[dict] = []
    llm = _llm([_msg(tool_calls=[call], finish="tool_calls"), _msg("Try the general term [S1].")], requests)

    res = TutorAgent(llm, _retriever(), model="anthropic/test").reply(
        scope=AccessScope(1), mode=TutorMode.PRACTICE, language="en",
        history=[{"role": "user", "content": "Help with 2019 Q12"}])

    assert res.content == "Try the general term [S1]."
    assert res.sources and res.sources[0]["question_number"] == "12"
    assert res.tokens_used == 240
    second = requests[1]["messages"]
    assert second[0]["role"] == "system"
    assert second[-2]["tool_calls"][0]["id"] == "call_1"
    assert second[-1] == {"role": "tool", "tool_call_id": "call_1", "content": second[-1]["content"]}
    assert "binomial" in second[-1]["content"]


def test_openrouter_forced_answer_replays_calls_as_text():
    call = {"id": "c", "type": "function", "function": {"name": "search_knowledge_base",
                                                         "arguments": '{"query": "binomial"}'}}
    requests: list[dict] = []
    llm = _llm([_msg(tool_calls=[call], finish="tool_calls"), _msg("Done.")], requests)

    res = TutorAgent(llm, _retriever(), model="m", max_rounds=1).reply(
        scope=AccessScope(1), mode=TutorMode.FREE, language="en",
        history=[{"role": "user", "content": "binomial?"}])

    assert res.content == "Done."
    final = requests[1]
    assert "tools" not in final
    assert all(m["role"] != "tool" and "tool_calls" not in m for m in final["messages"])


def test_openrouter_model_list_becomes_fallbacks():
    requests: list[dict] = []
    llm = _llm([_msg("hi")], requests)
    llm.create(model="a/x:free, b/y:free", max_tokens=10, system="s",
               messages=[{"role": "user", "content": "hi"}])
    assert requests[0]["model"] == "a/x:free"
    assert requests[0]["models"] == ["a/x:free", "b/y:free"]


def test_openrouter_error_body_raises():
    requests: list[dict] = []
    llm = _llm([{"error": {"message": "No endpoints found", "code": 404}}], requests)
    try:
        llm.create(model="m", max_tokens=10, system="s", messages=[{"role": "user", "content": "hi"}])
    except RuntimeError as e:
        assert "No endpoints found" in str(e)
    else:
        raise AssertionError("expected RuntimeError")
