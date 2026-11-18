# KELU backend image (FastAPI). Build context is backend/:
#   docker build -f infra/Dockerfile -t kelu-backend backend
# Includes sentence-transformers for the local embedding models (EMBEDDING_PROVIDER=e5-small or
# bge-m3). Build with --build-arg LOCAL_EMBEDDINGS=false for a small image that uses Bedrock instead.
# Secrets are never baked in; they come from the env file at run time (infra/docker-compose.prod.yml).
FROM python:3.13-slim

ARG LOCAL_EMBEDDINGS=true

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models

WORKDIR /app

COPY requirements-server.txt requirements-embeddings.txt ./
RUN pip install -r requirements-server.txt
# CPU-only PyTorch first (the PyPI default on Linux can pull GBs of GPU libraries), then the rest.
RUN if [ "$LOCAL_EMBEDDINGS" = "true" ]; then \
      pip install --index-url https://download.pytorch.org/whl/cpu "$(grep '^torch==' requirements-embeddings.txt)" \
      && pip install -r requirements-embeddings.txt; \
    fi

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# Run as a normal user, not root. /models holds the downloaded model weights (a Docker volume,
# so the download happens once, not on every rebuild).
# a+rX: the code must be readable by that user even if the checkout on the server has owner-only
# permissions (a strict umask during `git pull` once made the backend crash-loop).
RUN useradd --create-home --uid 1000 kelu && mkdir -p /models && chown kelu /models \
    && chmod -R a+rX /app
USER kelu

EXPOSE 8000
# Bring the database schema up to date, then serve. One worker on purpose: knowledge-base job
# progress lives in process memory (app/services/knowledge_base.py), and each worker would load
# its own copy of the model.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
