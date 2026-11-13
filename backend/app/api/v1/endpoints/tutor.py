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
from app.rag.images import BadImage, parse_data_url
from app.rag.embeddings import build_embedder
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.rag.quiz import PRACTICE_SIZE, NoQuestionsIndexed, QuizGenerator, QuizIncomplete
from app.rag.retrieval import Retriever
from app.rag.tamil_text import question_language
from app.rag.types import AccessScope, TutorMode
from app.rag.vector_store import VectorStore
from app.services import quiz_bank, quiz_plan
from app.services.topics import by_key

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
    # A photo/screenshot for the newest message, as a data URL (the browser shrinks it first).
    # Sent with that message only; never stored.
    image: str | None = Field(default=None, max_length=4_500_000)


class FullQuizRequest(BaseModel):
    lang: str = Field(default="en", pattern="^(en|ta)$")
    exclude: list[int] = Field(default_factory=list, max_length=500)   # bank ids this student saw recently


class QuizQuestionRequest(BaseModel):
    lang: str = Field(default="en", pattern="^(en|ta)$")
    slot: int = Field(ge=1, le=PRACTICE_SIZE)      # its place in the quiz
    topic: str                                     # the subject's key


@lru_cache
def _retriever() -> Retriever:
    """Built once: loading the embedder takes ~25 s."""
    s = get_rag_settings()
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    store = VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, embedder.dim)
    store.ensure_collection()
    return Retriever(store, embedder, top_k=s.retrieval_top_k, min_score=s.retrieval_min_score)


def _llm(purpose: str = "other", reasoning_tokens: int | None = None):
    s = get_rag_settings()
    try:
        return build_llm(s.openrouter_api_key, s.openrouter_base_url, temperature=s.llm_temperature, purpose=purpose,
                         reasoning_tokens=reasoning_tokens)
    except LLMNotConfigured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "tutor_not_configured"}) from None


def _admin_api_key(s) -> str | None:
    """Which key admin-only AI work runs on. Students never reach this.
    Strict: LLM_API_KEY2 only, never LLM_API_KEY (that key is for students only)."""
    return s.admin_llm_api_key


def _admin_llm(purpose: str):
    """Admin-only AI (quiz-bank drafts, feedback review), on LLM_API_KEY2."""
    s = get_rag_settings()
    try:
        return build_llm(_admin_api_key(s), s.openrouter_base_url, temperature=s.admin_llm_temperature,
                         purpose=purpose)
    except LLMNotConfigured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "admin_ai_not_configured"}) from None


def get_admin_quiz_generator() -> QuizGenerator:
    s = get_rag_settings()
    return QuizGenerator(_admin_llm("admin_quiz"), _retriever(),
                         model=s.admin_quiz_model or s.quiz_model or s.llm_model, tamil_model=s.tamil_model)


def get_agent() -> TutorAgent:
    s = get_rag_settings()
    return TutorAgent(_llm("tutor", s.agent_reasoning_tokens), _retriever(), model=s.llm_model,
                      max_rounds=s.agent_max_tool_rounds, max_tokens=s.agent_max_output_tokens,
                      search_first=s.agent_search_first, vision_model=s.vision_model,
                      tamil_model=s.tamil_model)


def get_quiz_generator() -> QuizGenerator:
    s = get_rag_settings()
    return QuizGenerator(_llm("quiz"), _retriever(), model=s.quiz_model or s.llm_model, tamil_model=s.tamil_model)


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
    image = None
    if req.image:
        try:
            image = parse_data_url(req.image)
        except BadImage as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": e.code}) from None
    try:
        # Answer in the language of the question (a Tamil question gets a Tamil answer even when
        # the app is in English); a question that is only maths keeps the app's language.
        lang = question_language(req.history[-1].content) or req.lang
        res = agent.reply(scope=_scope(user), mode=req.mode, language=lang, hint_level=req.hint_level,
                          history=[t.model_dump() for t in req.history[-HISTORY_TURNS:]], image=image)
    except Exception:
        log.exception("tutor reply failed for user %s", user.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "tutor_failed"}) from None
    return {"content": res.content, "sources": res.sources, "tool_calls": res.tool_calls,
            "tokens": res.tokens_used, "truncated": res.truncated, "model": res.model_name,
            "hint_level": res.hint_level, "lang": lang}


@router.post("/quiz/set")
def full_quiz(req: FullQuizRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """The whole-syllabus quiz, for exam-year students: published bank questions, up to 5 Pure
    and 5 Applied. It reads only the database, so it never makes an AI request."""
    if not quiz_plan.can_take_full_quiz(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "full_quiz_locked"})
    questions = quiz_bank.pick_full_quiz(db, req.lang, set(req.exclude))
    if not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "no_bank_questions"})
    return {"questions": questions}


@router.post("/quiz/question")
def quiz_question(req: QuizQuestionRequest, user: User = Depends(get_current_user),
                  generator: QuizGenerator = Depends(get_quiz_generator)) -> dict:
    """One new question on a subject, for place `slot` of a student's quiz, where question 1 is the
    easiest and question 5 the hardest. The page asks for each separately, so the first appears
    while the rest are written. Questions aren't
    stored: only the student's marks are (POST /progress/attempts)."""
    topic = by_key(req.topic)
    if not topic:
        raise HTTPException(422, detail={"code": "unknown_topic"})
    # Global library only: a practice question must not draw on a student's private upload.
    scope = AccessScope(user_id=user.id, role=user.role.value, include_private=False)
    try:
        q = generator.generate_for_topic(scope=scope, language=req.lang, slot=req.slot, topic=topic, level=req.slot)
    except NoQuestionsIndexed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "no_questions_indexed"}) from None
    except QuizIncomplete:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "quiz_failed"}) from None
    except Exception:
        log.exception("quiz question failed for user %s", user.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"code": "quiz_failed"}) from None
    return {"question": asdict(q), "model": generator.model}
