"""RAG settings, read from environment / backend/.env (never commit .env).

Kept apart from app.core.config so the RAG layer, its CLI and its tests run
without a database or JWT secret.

Every LLM call (tutor chat, quiz, OCR) goes through OpenRouter. Embeddings stay
local (BGE-M3), so only one API key is needed: LLM_API_KEY (or OPENROUTER_API_KEY).
"""
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute, so the CLI and the API find backend/.env and backend/var from any working directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]


class RagSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Vector DB (Qdrant). URL of a server, ":memory:" for tests, or a folder
    # path (e.g. ./var/qdrant-local) for embedded mode without Docker.
    vector_db_url: str = "http://localhost:6333"
    vector_db_api_key: str | None = None
    vector_collection: str = "kelu_chunks_v1"   # bump suffix when embedding model changes

    # Embeddings: self-hosted BGE-M3 (Tamil + English in one vector space).
    embedding_provider: str = "bge-m3"         # bge-m3 | fake
    embedding_dim: int = 1024

    # Chunking
    chunk_max_chars: int = 1800
    chunk_overlap_chars: int = 200

    # Retrieval
    retrieval_top_k: int = 6
    retrieval_min_score: float = 0.35

    # OpenRouter. A comma list in a *_MODEL setting is a fallback chain:
    # "a,b,c" -> OpenRouter tries a, then b, then c (free models are often rate-limited).
    # LLM_API_KEY is the generic name; OPENROUTER_API_KEY still works.
    openrouter_api_key: str | None = Field(None, validation_alias=AliasChoices("LLM_API_KEY", "OPENROUTER_API_KEY"))
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "anthropic/claude-sonnet-5.5"      # tutor chat
    quiz_model: str | None = None                       # None = llm_model
    agent_max_tool_rounds: int = 4
    agent_search_first: bool = True             # always search papers first; answer only from them
    agent_max_output_tokens: int = 1200

    # OCR (scanned past papers -> text) with an OpenRouter vision model.
    ocr_model: str = "anthropic/claude-sonnet-5.5"
    ocr_dir: str = str(BACKEND_DIR / "var" / "ocr")   # one .md per page; re-runs skip done pages
    ocr_workers: int = 4


@lru_cache
def get_rag_settings() -> RagSettings:
    return RagSettings()
