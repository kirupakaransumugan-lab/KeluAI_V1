"""Agentic RAG loop: the model decides what to retrieve, we execute tools
under the student's AccessScope, bounded by rounds and tokens.

Returns everything the API layer needs to write one `tutor_messages` row:
content, sources (JSON), model_name, tokens_used, hint_level.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from ..retrieval import Retriever
from ..types import AccessScope, TutorMode
from .openrouter_llm import OPENROUTER_URL, OpenRouterLLM
from ..images import Image
from ..tamil_text import tamil_reply_problems
from .prompts import IMAGE_NOTE, PAPERS_ONLY, PREFETCH, TAMIL_REPAIR, system_prompt
from .tools import ToolContext, run_tool, tool_definitions

EXAM_LOCKED_REPLY = {
    "en": "The tutor is paused during exam mode. Submit your attempt and I'll go through it with you.",
    "ta": "பரீட்சை முறையில் உதவியாளர் இடைநிறுத்தப்பட்டுள்ளது. உங்கள் விடைகளைச் சமர்ப்பித்த பின் நாம் சேர்ந்து பார்க்கலாம்.",
}


class LLMClient(Protocol):
    """Anthropic Messages-shaped create(); OpenRouterLLM and the test fakes satisfy it."""
    def create(self, **kwargs: Any) -> Any: ...


@dataclass
class AgentResult:
    content: str
    sources: list[dict]
    model_name: str
    tokens_used: int
    hint_level: int
    tool_calls: list[dict] = field(default_factory=list)
    truncated: bool = False


class TutorAgent:
    def __init__(self, llm: LLMClient, retriever: Retriever, model: str,
                 max_rounds: int = 4, max_tokens: int = 1200, search_first: bool = False,
                 vision_model: str | None = None, tamil_model: str | None = None):
        """search_first: always search the knowledge base with the student's
        message before the model runs, and restrict answers to what was found.
        Does not rely on the model choosing to call a tool (small models skip it)."""
        self.search_first = search_first
        self.llm = llm
        self.retriever = retriever
        self.model = model
        self.vision_model = vision_model or model
        self.tamil_model = tamil_model or model
        self.max_rounds = max_rounds
        self.max_tokens = max_tokens

    def reply(self, *, scope: AccessScope, mode: TutorMode, language: str,
              history: list[dict], hint_level: int = 0,
              bound_upload_id: int | None = None, context_note: str | None = None,
              image: Image | None = None) -> AgentResult:
        """`history` = prior turns as [{"role": "user"|"assistant", "content": str}],
        ending with the student's new message. Load it from tutor_messages
        (last ~20 turns) so conversations are resumable.
        `image`: attached to that new message only, and answered by the vision model."""
        if mode == TutorMode.EXAM:
            return AgentResult(EXAM_LOCKED_REPLY.get(language, EXAM_LOCKED_REPLY["en"]),
                               [], self.model, 0, hint_level)

        ctx = ToolContext(scope=scope, mode=mode, language=language, bound_upload_id=bound_upload_id)
        tools = tool_definitions(ctx)
        system = system_prompt(mode, language, hint_level, context_note)
        messages: list[dict] = [dict(m) for m in history]
        tokens = 0
        calls: list[dict] = []

        last = messages[-1] if messages else None
        if self.search_first and last and last["role"] == "user" and isinstance(last["content"], str):
            # Plain text, not a synthetic tool_use: Gemini rejects function calls it didn't sign.
            found = run_tool("search_knowledge_base", {"query": last["content"]}, ctx, self.retriever)
            calls.append({"name": "search_knowledge_base", "input": {"query": last["content"][:80]}})
            last["content"] += PREFETCH.format(results=found)
            system += "\n\n" + PAPERS_ONLY

        model = self.tamil_model if language == "ta" else self.model
        if image and last and last["role"] == "user" and isinstance(last["content"], str):
            last["content"] = [{"type": "text", "text": last["content"]},
                               {"type": "image", "media_type": image.media_type, "data": image.data}]
            system += "\n\n" + IMAGE_NOTE
            model = self.vision_model

        for round_no in range(self.max_rounds + 1):
            final_round = round_no == self.max_rounds
            kwargs: dict[str, Any] = dict(model=model, max_tokens=self.max_tokens,
                                          system=system, messages=messages)
            if not final_round:
                kwargs["tools"] = tools          # last round: force a text answer
            resp = self.llm.create(**kwargs)
            usage = getattr(resp, "usage", None)
            if usage:
                tokens += (getattr(usage, "input_tokens", 0) or 0) + (getattr(usage, "output_tokens", 0) or 0)

            blocks = list(resp.content)
            tool_uses = [b for b in blocks if getattr(b, "type", None) == "tool_use"]

            if resp.stop_reason != "tool_use" or not tool_uses:
                text = "".join(getattr(b, "text", "") for b in blocks if getattr(b, "type", None) == "text").strip()
                if language == "ta" and text:
                    text, used = self._repair_tamil(text, model)
                    tokens += used
                return AgentResult(
                    content=text or self._fallback(language),
                    sources=self._cited_sources(ctx, text),
                    model_name=model, tokens_used=tokens,
                    hint_level=hint_level, tool_calls=calls,
                    truncated=resp.stop_reason == "max_tokens",
                )

            messages.append({"role": "assistant", "content": [_block_to_dict(b) for b in blocks]})
            results = []
            for tu in tool_uses:
                out = run_tool(tu.name, dict(tu.input or {}), ctx, self.retriever)
                calls.append({"name": tu.name, "input": dict(tu.input or {})})
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": out})
            messages.append({"role": "user", "content": results})

        return AgentResult(self._fallback(language), [], model, tokens, hint_level, calls)

    def _repair_tamil(self, text: str, model: str) -> tuple[str, int]:
        """A Tamil reply with foreign words or broken letters is rewritten once, in clear Tamil.
        The rewrite is kept only if it has fewer problems; any failure keeps the original."""
        problems = tamil_reply_problems(text)
        if not problems:
            return text, 0
        try:
            resp = self.llm.create(model=model, max_tokens=self.max_tokens, system=TAMIL_REPAIR,
                                   messages=[{"role": "user", "content": text}])
        except Exception:
            return text, 0
        usage = getattr(resp, "usage", None)
        used = ((getattr(usage, "input_tokens", 0) or 0) + (getattr(usage, "output_tokens", 0) or 0)) if usage else 0
        fixed = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text").strip()
        if fixed and len(tamil_reply_problems(fixed)) < len(problems):
            return fixed, used
        return text, used

    @staticmethod
    def _fallback(language: str) -> str:
        return ("மன்னிக்கவும், இப்போது பதில் தர முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
                if language == "ta" else "Sorry, I couldn't produce an answer. Please try again.")

    @staticmethod
    def _cited_sources(ctx: ToolContext, text: str) -> list[dict]:
        """Store only sources the reply actually cites ([S1]...); if it cites
        none, store nothing rather than implying grounding."""
        out = []
        for i, h in enumerate(ctx.hits, start=1):
            if f"[S{i}]" in text:
                out.append({"label": f"S{i}", **h.citation()})
        return out


def _block_to_dict(b: Any) -> dict:
    if hasattr(b, "model_dump"):
        return b.model_dump(exclude_none=True)
    if b.type == "text":
        return {"type": "text", "text": b.text}
    return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}


class LLMNotConfigured(RuntimeError):
    pass


def build_llm(api_key: str | None, base_url: str = OPENROUTER_URL, temperature: float | None = None) -> OpenRouterLLM:
    """Every KELU model call goes through OpenRouter."""
    if not api_key:
        raise LLMNotConfigured("LLM_API_KEY is not configured in backend/.env")
    return OpenRouterLLM(api_key, base_url, temperature=temperature)
