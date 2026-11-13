"""OpenRouter adapter for TutorAgent and QuizGenerator (any model OpenRouter serves).

TutorAgent speaks the Anthropic Messages shape: a system prompt, messages
holding tool_use / tool_result blocks, and a response with .content,
.stop_reason and .usage. This adapter translates that shape to OpenRouter's
OpenAI-compatible /chat/completions and back, so the agent loop, the tools
and the tests stay provider-neutral.

OpenRouter specifics handled here:
  * tool calls carry real ids, so they are kept and results are sent back as
    role "tool" messages with the matching tool_call_id;
  * tool arguments arrive as a JSON string, not an object;
  * errors can come back as HTTP 200 with an "error" body (upstream failures);
  * on the forced-answer round (no tools) earlier calls are replayed as text,
    as some upstream providers reject tool history without a tools list;
  * "a,b,c" as the model becomes a fallback chain (models list).
"""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1"
REASONING_HEADROOM = 4096
ANSWER_NOW = "(No more lookups are available. Answer the student now using the results above.)"

log = logging.getLogger(__name__)

# Called after every OpenRouter call with (purpose, model, input_tokens, output_tokens, cost_usd,
# ok, error). The API registers one that writes ai_usage rows (app/services/ai_usage.py); with
# none set (tests, scripts) nothing is recorded. A failing recorder never breaks the AI call.
UsageRecorder = Callable[[str, str, int, int, "float | None", bool, "str | None"], None]
_recorder: UsageRecorder | None = None


# Free models sometimes answer "successfully" with no text. OpenRouter's fallback list only
# moves on after an error, so every later call would be spent on the same dead model. A model
# that answers empty is skipped for EMPTY_SKIP_SECONDS, across all calls in this process, and
# the call goes straight to the next model in its chain. Free quotas are counted per request.
EMPTY_SKIP_SECONDS = 3600
_skip_until: dict[str, float] = {}
_skip_lock = threading.Lock()


def _live(names: list[str]) -> list[str]:
    """`names` minus models being skipped; all of them if every one is (better than no call)."""
    now = time.monotonic()
    with _skip_lock:
        live = [n for n in names if _skip_until.get(n, 0) <= now]
    return live or names


def _skip(model: str) -> None:
    with _skip_lock:
        _skip_until[model] = time.monotonic() + EMPTY_SKIP_SECONDS


def _is_empty(resp: "Response") -> bool:
    return not any(b.type == "tool_use" or b.text.strip() for b in resp.content)


def set_usage_recorder(recorder: UsageRecorder | None) -> None:
    global _recorder
    _recorder = recorder


def _record(*args) -> None:
    if _recorder is None:
        return
    try:
        _recorder(*args)
    except Exception:
        log.warning("could not record AI usage", exc_info=True)


@dataclass
class Block:
    type: str                       # "text" | "tool_use"
    text: str = ""
    id: str = ""
    name: str = ""
    input: dict = field(default_factory=dict)

    def model_dump(self, exclude_none: bool = False) -> dict:
        """Called by tutor_agent._block_to_dict when echoing the turn back."""
        if self.type == "text":
            return {"type": "text", "text": self.text}
        return {"type": "tool_use", "id": self.id, "name": self.name, "input": self.input}


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int


@dataclass
class Response:
    content: list[Block]
    stop_reason: str                # "tool_use" | "max_tokens" | "end_turn"
    usage: Usage


class OpenRouterLLM:
    """Satisfies tutor_agent.LLMClient: create(**anthropic_style_kwargs)."""

    def __init__(self, api_key: str, base_url: str = OPENROUTER_URL, timeout: float = 120,
                 temperature: float | None = None, purpose: str = "other",
                 reasoning_tokens: int = REASONING_HEADROOM):
        self.temperature = temperature
        # Hidden thinking a reasoning model may do before it writes. Quiz writing keeps the full
        # 4096; tutor chat uses less, because every thinking token is waiting time for the student.
        self.reasoning_tokens = reasoning_tokens
        self.purpose = purpose          # what the calls are for, in the admin's AI usage figures
        self._http = httpx.Client(base_url=base_url, timeout=timeout, headers={
            "Authorization": f"Bearer {api_key}",
            "X-Title": "KELU tutor",        # shown on the OpenRouter usage page
        })

    def create(self, *, model: str, max_tokens: int, system: str, messages: list[dict],
               tools: list[dict] | None = None, **_: Any) -> Response:
        msgs = [{"role": "system", "content": system}, *_to_messages(messages, as_text=not tools)]
        if not tools and msgs[-1]["role"] in ("user", "tool") and _has_tool_history(messages):
            msgs.append({"role": "user", "content": ANSWER_NOW})
        return self._post(model, msgs, max_tokens, tools)

    def complete_raw(self, *, model: str, max_tokens: int, messages: list[dict]) -> Response:
        """Messages already in OpenAI format (e.g. image parts for OCR)."""
        return self._post(model, messages, max_tokens, None)

    def _post(self, model: str, msgs: list[dict], max_tokens: int, tools: list[dict] | None) -> Response:
        names = _live([m.strip() for m in model.split(",") if m.strip()])
        # Reasoning models spend max_tokens on hidden thinking first and can return no text,
        # so cap thinking and add it on top.
        body: dict[str, Any] = {"model": names[0], "messages": msgs,
                                "max_tokens": max_tokens + self.reasoning_tokens,
                                "reasoning": {"max_tokens": self.reasoning_tokens, "exclude": True}}
        if self.temperature is not None:
            body["temperature"] = self.temperature
        if len(names) > 1:
            body["models"] = names
        if tools:
            body["tools"] = [{"type": "function", "function": {
                "name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
                for t in tools]
        try:
            r = self._http.post("/chat/completions", json=body)
        except httpx.HTTPError as e:
            _record(self.purpose, names[0], 0, 0, None, False, f"network: {type(e).__name__}")
            raise
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400 or "error" in data:
            err = data.get("error") or {}
            msg = err.get("message") if isinstance(err, dict) else err
            _record(self.purpose, names[0], 0, 0, None, False, f"{r.status_code}: {msg or ''}"[:200])
            raise RuntimeError(f"OpenRouter {r.status_code}: {msg or r.text[:300]}")
        resp = _from_response(data, allow_calls=bool(tools))
        cost = (data.get("usage") or {}).get("cost")
        used = data.get("model") or names[0]
        empty = _is_empty(resp)
        _record(self.purpose, used, resp.usage.input_tokens, resp.usage.output_tokens,
                float(cost) if isinstance(cost, (int, float)) else None, not empty, "empty reply" if empty else None)
        if empty:
            _skip(used)
            rest = [n for n in names if n != used]
            if rest:
                log.warning("%s answered empty; skipping it for %ss and trying %s", used, EMPTY_SKIP_SECONDS, rest[0])
                return self._post(",".join(rest), msgs, max_tokens, tools)
        return resp


def _has_tool_history(messages: list[dict]) -> bool:
    return any(isinstance(m["content"], list) and any(b.get("type") in ("tool_use", "tool_result") for b in m["content"])
               for m in messages)


def _user_parts(blocks: list[dict]) -> list[dict]:
    """A student message with an attached image, as OpenAI content parts."""
    parts: list[dict] = []
    for b in blocks:
        if b["type"] == "text" and b.get("text"):
            parts.append({"type": "text", "text": b["text"]})
        elif b["type"] == "image":
            parts.append({"type": "image_url", "image_url": {"url": f"data:{b['media_type']};base64,{b['data']}"}})
    return parts


def _to_messages(messages: list[dict], *, as_text: bool) -> list[dict]:
    names: dict[str, str] = {}      # tool_use id -> function name (for the as_text replay)
    out: list[dict] = []
    for m in messages:
        blocks = m["content"]
        if isinstance(blocks, str):
            out.append({"role": m["role"], "content": blocks})
            continue
        text = "".join(b.get("text", "") for b in blocks if b["type"] == "text")
        if m["role"] == "assistant":
            calls = [b for b in blocks if b["type"] == "tool_use"]
            for b in calls:
                names[b["id"]] = b["name"]
            if as_text or not calls:
                text += "".join(f"\n(looked up {b['name']} {b['input']})" for b in calls)
                out.append({"role": "assistant", "content": text})
            else:
                out.append({"role": "assistant", "content": text or None, "tool_calls": [
                    {"id": b["id"], "type": "function",
                     "function": {"name": b["name"], "arguments": json.dumps(b["input"])}}
                    for b in calls]})
        elif any(b["type"] == "image" for b in blocks):
            out.append({"role": "user", "content": _user_parts(blocks)})
        else:
            for b in blocks:
                if b["type"] != "tool_result":
                    continue
                if as_text:
                    name = names.get(b["tool_use_id"], "tool")
                    out.append({"role": "user", "content": f"Result of {name}:\n{b['content']}"})
                else:
                    out.append({"role": "tool", "tool_call_id": b["tool_use_id"], "content": b["content"]})
            if text:
                out.append({"role": "user", "content": text})
    return out


def _from_response(data: dict, allow_calls: bool = True) -> Response:
    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    blocks: list[Block] = []
    if msg.get("content"):
        blocks.append(Block("text", text=msg["content"]))
    for tc in (msg.get("tool_calls") or []) if allow_calls else []:
        fn = tc.get("function") or {}
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:            # malformed args: let the tool report the error
            args = {}
        blocks.append(Block("tool_use", id=tc.get("id") or f"or_{uuid.uuid4().hex[:8]}",
                            name=fn.get("name", ""), input=args if isinstance(args, dict) else {}))

    if any(b.type == "tool_use" for b in blocks):
        stop = "tool_use"
    elif choice.get("finish_reason") == "length":
        stop = "max_tokens"
    else:
        stop = "end_turn"
    u = data.get("usage") or {}
    return Response(blocks, stop, Usage(u.get("prompt_tokens") or 0, u.get("completion_tokens") or 0))
