"""Tools the tutor agent can call.

Security model:
  * The AccessScope and the bound upload_id come from the server session,
    never from the model. Tool inputs can only narrow a search.
  * Which tools exist depends on the mode. Marking schemes are not even
    offered outside REVIEW, and are stripped from `sources` server-side.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..retrieval import Retriever
from ..types import AccessScope, SearchHit, TutorMode

PUBLIC_SOURCES = ["syllabus", "past_paper", "notes"]
REVIEW_SOURCES = PUBLIC_SOURCES + ["marking_scheme"]


@dataclass
class ToolContext:
    scope: AccessScope
    mode: TutorMode
    language: str
    bound_upload_id: int | None = None          # tutor_conversations.upload_id
    hits: list[SearchHit] = field(default_factory=list)  # everything shown to the model

    def label(self, hit: SearchHit) -> str:
        for i, h in enumerate(self.hits, start=1):
            if (h.upload_id, h.page, h.question_number, h.text[:40]) == \
               (hit.upload_id, hit.page, hit.question_number, hit.text[:40]):
                return f"S{i}"
        self.hits.append(hit)
        return f"S{len(self.hits)}"


def tool_definitions(ctx: ToolContext) -> list[dict]:
    allowed = REVIEW_SOURCES if ctx.mode == TutorMode.REVIEW else PUBLIC_SOURCES
    tools = [
        {
            "name": "search_knowledge_base",
            "description": ("Semantic search over the approved Combined Mathematics syllabus, "
                            "verified past papers" +
                            (", marking schemes" if ctx.mode == TutorMode.REVIEW else "") +
                            " and the student's own notes. Use for concepts, definitions, "
                            "similar past questions, or methods."),
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to look for, in Tamil or English."},
                    "sources": {"type": "array", "items": {"type": "string", "enum": allowed},
                                "description": "Limit to these document types. Omit for all."},
                    "exam_year": {"type": "integer"},
                },
                "required": ["query"],
            },
        },
        {
            "name": "get_past_paper_question",
            "description": ("Fetch the exact text of a past-paper question by year and number. "
                            "Paper I is Pure Mathematics, Paper II is Applied Mathematics; both "
                            "number questions from 1, so pass `paper` whenever you know it."),
            "input_schema": {
                "type": "object",
                "properties": {
                    "exam_year": {"type": "integer"},
                    "question_number": {"type": "string"},
                    "paper": {"type": "string", "enum": ["I", "II"],
                              "description": "I = Pure, II = Applied"},
                    "paper_part": {"type": "string", "enum": ["A", "B"]},
                },
                "required": ["exam_year", "question_number"],
            },
        },
    ]
    if ctx.mode == TutorMode.REVIEW:
        tools.append({
            "name": "get_marking_scheme",
            "description": "Fetch the official marking scheme for a past-paper question.",
            "input_schema": tools[1]["input_schema"],
        })
    if ctx.bound_upload_id:
        tools.append({
            "name": "search_my_document",
            "description": "Search inside the PDF the student opened this conversation about.",
            "input_schema": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        })
    return tools


def _render(ctx: ToolContext, hits: list[SearchHit]) -> str:
    if not hits:
        return "NO_RESULTS: nothing relevant was found. Say you could not verify this."
    out = []
    for h in hits:
        meta = ", ".join(x for x in (
            h.upload_type, str(h.exam_year) if h.exam_year else None,
            f"Paper {h.paper} ({'Pure' if h.paper == 'I' else 'Applied'})" if h.paper else None,
            f"Part {h.paper_part}" if h.paper_part else None,
            f"Q{h.question_number}" if h.question_number else None,
            f"p.{h.page}" if h.page else None, h.language,
        ) if x)
        out.append(f"[{ctx.label(h)}] ({meta})\n<document>\n{h.text}\n</document>")
    return "\n\n".join(out)


def run_tool(name: str, args: dict, ctx: ToolContext, retriever: Retriever) -> str:
    allowed = REVIEW_SOURCES if ctx.mode == TutorMode.REVIEW else PUBLIC_SOURCES

    if name == "search_knowledge_base":
        sources = [s for s in (args.get("sources") or allowed) if s in allowed] or allowed
        hits = retriever.search(ctx.scope, str(args.get("query", ""))[:500],
                                upload_types=sources, exam_year=args.get("exam_year"))
        return _render(ctx, hits)

    if name in ("get_past_paper_question", "get_marking_scheme"):
        if name == "get_marking_scheme" and ctx.mode != TutorMode.REVIEW:
            return "ERROR: marking schemes are only available after the attempt is submitted."
        try:
            year = int(args["exam_year"])
        except (KeyError, TypeError, ValueError):
            return "ERROR: exam_year must be an integer."
        lookup = dict(
            exam_year=year, question_number=str(args.get("question_number", "")),
            paper=args.get("paper"), paper_part=args.get("paper_part"),
            upload_type="marking_scheme" if name == "get_marking_scheme" else "past_paper",
        )
        # Prefer the student's medium; fall back to the other medium if that's all we have.
        hits = retriever.get_question(ctx.scope, language=ctx.language, **lookup) \
            or retriever.get_question(ctx.scope, **lookup)
        papers = {h.paper for h in hits if h.paper}
        if len(papers) > 1:
            return ("AMBIGUOUS: this question number exists in both Paper I (Pure) and "
                    "Paper II (Applied). Ask the student which paper, or call again with `paper`.")
        return _render(ctx, hits)

    if name == "search_my_document":
        if not ctx.bound_upload_id:
            return "ERROR: no document is attached to this conversation."
        hits = retriever.search(ctx.scope, str(args.get("query", ""))[:500],
                                upload_id=ctx.bound_upload_id)
        return _render(ctx, hits)

    return f"ERROR: unknown tool {name}"
