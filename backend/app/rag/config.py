"""RAG settings, read from environment / backend/.env (never commit .env).

Kept apart from app.core.config so the RAG layer, its CLI and its tests run
without a database or JWT secret.

Every LLM call (tutor chat, quiz, OCR) goes through OpenRouter. Embeddings stay
local (BGE-M3) in dev and come from Amazon Bedrock in production (EMBEDDING_PROVIDER=bedrock). Students use LLM_API_KEY (or OPENROUTER_API_KEY); admin-only work
(quiz-bank generation, feedback review) uses LLM_API_KEY2.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute, so the CLI and the API find backend/.env and backend/var from any working directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]


class RagSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Vector DB (Qdrant). URL of a server, ":memory:" for tests, or a folder
    # path (e.g. ./var/qdrant-local) for embedded mode without Docker.
    vector_db_url: str = "http://127.0.0.1:6333"   # not localhost: on Windows it tries IPv6 first and costs 2 s a call
    vector_db_api_key: str | None = None
    vector_collection: str = "kelu_chunks_v1"   # bump suffix when embedding model changes

    # Embeddings (Tamil + English in one vector space): see app/rag/embeddings.py.
    embedding_provider: str = "bge-m3"         # bge-m3 | bedrock | fake
    embedding_dim: int = 1024
    # Bedrock: cohere.embed-multilingual-v3 (1024-dim), cohere.embed-v4:0, or amazon.titan-embed-text-v2:0.
    bedrock_embedding_model: str = "cohere.embed-multilingual-v3"
    bedrock_region: str | None = Field(None, validation_alias=AliasChoices("BEDROCK_REGION", "S3_REGION", "AWS_REGION"))
    # The same AWS keys as file storage. Unset = boto3's own lookup (e.g. the EC2 server's IAM role).
    aws_access_key_id: str | None = Field(None, validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: SecretStr | None = Field(None, validation_alias="AWS_SECRET_ACCESS_KEY")

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
    vision_model: str | None = None                     # a turn with an attached image; None = llm_model
    tamil_model: str | None = None                      # Tamil replies; None = llm_model (free models
                                                        # write poor Tamil: set a stronger one here)
    llm_temperature: float = 0.3                        # low: free models drift into other languages
                                                        # (and garble Tamil) at the default 1.0
                                                        # (set it if llm_model can't read images)
    quiz_model: str | None = None                       # None = llm_model

    # Admin-only AI: a separate key (LLM_API_KEY2) so admin quiz-bank generation and feedback
    # review are billed and rate-limited apart from student traffic. Students never use it.
    admin_llm_api_key: str | None = Field(None, validation_alias=AliasChoices("LLM_API_KEY2", "ADMIN_LLM_API_KEY"))
    admin_quiz_model: str | None = None                 # bank drafts; None = quiz_model / llm_model
    admin_llm_temperature: float = 0.2                  # drafts are reviewed and stored: favour
                                                        # correct working over variety

    agent_max_tool_rounds: int = 4
    agent_search_first: bool = True             # always search papers first; answer only from them
    agent_max_output_tokens: int = 1600         # room for a ```graph block on top of the working
    agent_reasoning_tokens: int = 1536          # hidden thinking per tutor reply (quizzes keep 4096):
                                                # less thinking = a faster first word for the student

    # OCR (scanned past papers -> text) with an OpenRouter vision model.
    ocr_model: str = "anthropic/claude-sonnet-5.5"
    ocr_dir: str = str(BACKEND_DIR / "var" / "ocr")   # one .md per page; re-runs skip done pages
    ocr_workers: int = 4

    @model_validator(mode="after")
    def _collection_per_model(self) -> "RagSettings":
        """Vectors from different models can't share a collection: the scores would be noise.
        Switching to Bedrock without naming a collection gets its own, instead of silently
        mixing with the BGE-M3 one (VECTOR_COLLECTION set by hand always wins)."""
        if self.embedding_provider == "bedrock" and "vector_collection" not in self.model_fields_set:
            model = self.bedrock_embedding_model.split(":")[0].replace(".", "_").replace("-", "_")
            self.vector_collection = f"kelu_chunks_{model}_{self.embedding_dim}"
        return self


@lru_cache
def get_rag_settings() -> RagSettings:
    return RagSettings()
