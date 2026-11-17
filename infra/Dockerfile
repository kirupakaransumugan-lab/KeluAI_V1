# KELU backend image (FastAPI). Build context is backend/:
#   docker build -f infra/Dockerfile -t kelu-backend backend
# No local embedding model inside: production uses EMBEDDING_PROVIDER=bedrock.
# Secrets are never baked in; they come from the env file at run time (infra/docker-compose.prod.yml).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements-server.txt .
RUN pip install -r requirements-server.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# Run as a normal user, not root.
RUN useradd --create-home --uid 1000 kelu
USER kelu

EXPOSE 8000
# Bring the database schema up to date, then serve. One worker on purpose: knowledge-base job
# progress lives in process memory (app/services/knowledge_base.py).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
