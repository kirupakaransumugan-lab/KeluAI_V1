from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.rag.agent.openrouter_llm import set_usage_recorder
from app.services.ai_usage import make_recorder

app = FastAPI(title="KELU API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,  # needed for the httpOnly session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Every AI call made by this API process is written to ai_usage (admin Overview > AI usage).
set_usage_recorder(make_recorder(SessionLocal))


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
