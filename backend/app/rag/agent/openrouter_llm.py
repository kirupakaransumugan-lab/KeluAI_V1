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
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1"
REASONING_HEADROOM = 4096
ANSWER_NOW = "(No more lookups are available. Answer the student now using the results above.)"


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
                 temperature: float | None = None):
        self.temperature = temperature
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
        names = [m.strip() for m in model.split(",") if m.strip()]
        # Reasoning models spend max_tokens on hidden thinking first and can return no text,
        # so cap thinking and add it on top.
        body: dict[str, Any] = {"model": names[0], "messages": msgs,
                                "max_tokens": max_tokens + REASONING_HEADROOM,
                                "reasoning": {"max_tokens": REASONING_HEADROOM, "exclude": True}}
        if self.temperature is not None:
            body["temperature"] = self.temperature
        if len(names) > 1:
            body["models"] = names
        if tools:
            body["tools"] = [{"type": "function", "function": {
                "name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
                for t in tools]
        r = self._http.post("/chat/completions", json=body)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400 or "error" in data:
            err = data.get("error") or {}
            msg = err.get("message") if isinstance(err, dict) else err
            raise RuntimeError(f"OpenRouter {r.status_code}: {msg or r.text[:300]}")
        return _from_response(data, allow_calls=bool(tools))


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
