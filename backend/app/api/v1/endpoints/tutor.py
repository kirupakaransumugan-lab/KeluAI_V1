"""Tutor chat + AI practice quiz (agentic RAG over past papers).

The AccessScope is built here from the logged-in user, never from the request
body or the model, so a student only ever searches the global library plus
their own private uploads.
"""
import logging
from dataclasses import asdict
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user
from app.models.user import User
from app.rag.agent.tutor_agent import LLMNotConfigured, TutorAgent, build_llm
from app.rag.config import get_rag_settings
from app.rag.embeddings import build_embedder
from app.rag.quiz import QUIZ_SIZE, NoQuestionsIndexed, QuizGenerator
from app.rag.retrieval import Retriever
from app.rag.types import AccessScope, TutorMode
from app.rag.vector_store import VectorStore

log = logging.getLogger(__name__)
router = APIRouter(prefix="/tutor", tags=["tutor"])
HISTORY_TURNS = 20


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    history: list[Turn] = Field(min_length=1)     # ends with the student's new message
    mode: TutorMode = TutorMode.PRACTICE
    lang: str = Field(default="en", pattern="^(en|ta)$")
    hint_level: int = Field(default=0, ge=0, le=3)   # 0 nudge .. 3 worked step; the client raises it


class QuizRequest(BaseModel):
    lang: str = Field(default="en", pattern="^(en|ta)$")
    count: int = Field(default=QUIZ_SIZE, ge=1, le=QUIZ_SIZE)


@lru_cache
def _retriever() -> Retriever:
    """Built once: loading the embedder takes ~25 s."""
    s = get_rag_settings()
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    store = VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, embedder.dim)
    store.ensure_collection()
    return Retriever(store, embedder, top_k=s.retrieval_top_k, min_score=s.retrieval_min_score)


def _llm():
    s = get_rag_settings()
    try:
        return build_llm(s.openrouter_api_key, s.openrouter_base_url)
    except LLMNotConfigured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "tutor_not_configured"}) from None


def get_agent() -> TutorAgent:
    s = get_rag_settings()
    return TutorAgent(_llm(), _retriever(), model=s.llm_model,
                      max_rounds=s.agent_max_tool_rounds, max_tokens=s.agent_max_output_tokens,
                      search_first=s.agent_search_first)


def get_quiz_generator() -> QuizGenerator:
    s = get_rag_settings()
    return QuizGenerator(_llm(), _retriever(), model=s.quiz_model or s.llm_model)


def _scope(user: User) -> AccessScope:
    return AccessScope(user_id=user.id, role=user.role.value)


@router.get("/info")
def info(_: User = Depends(get_current_user)) -> dict:
    s = get_rag_settings()
    return {"model": s.llm_model, "modes": [m.value for m in TutorMode]}


@router.post("/chat")
def chat(req: ChatRequest, user: User = Depends(get_current_user),
         agent: TutorAgent = Depends(get_agent)) -> dict:
    # Plain `def`: FastAPI runs it in a worker thread, so the blocking LLM call is fine.
    if req.history[-1].role != "user":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "history_must_end_with_user"})
    try:
        res = agent.reply(scope=_scope(user), mode=req.mode, language=req.lang, hint_level=req.hint_level,
                          history=[t.model_dump() for t in req.history[-HISTORY_TURNS:]])
    except Exception:
        log.exception("tutor reply failed for user %s", user.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "tutor_failed"}) from None
    return {"content": res.content, "sources": res.sources, "tool_calls": res.tool_calls,
            "tokens": res.tokens_used, "truncated": res.truncated, "model": res.model_name,
            "hint_level": res.hint_level}


@router.post("/quiz")
def quiz(req: QuizRequest, user: User = Depends(get_current_user),
         generator: QuizGenerator = Depends(get_quiz_generator)) -> dict:
    """New AI-written Paper I Part A questions, styled on random past papers."""
    try:
        res = generator.generate(scope=_scope(user), language=req.lang, count=req.count)
    except NoQuestionsIndexed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "no_questions_indexed"}) from None
    except Exception:
        log.exception("quiz generation failed for user %s", user.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "quiz_failed"}) from None
    return {"questions": [asdict(q) for q in res.questions], "dropped": res.dropped,
            "tokens": res.tokens_used, "model": res.model_name}
