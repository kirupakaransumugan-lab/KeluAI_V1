"""Embedding providers behind one small interface.

Provider choice is an open decision. Requirements for KELU:
  * Tamil + English in the same vector space (a Tamil question must find an
    English-medium marking scheme for the same paper and vice versa).
  * Tolerates LaTeX / maths tokens.
Providers (EMBEDDING_PROVIDER): bge-m3 (self-hosted, default for local dev), bedrock (hosted
on AWS, used in production so the server needs little RAM), fake (tests).
"""
from __future__ import annotations

import hashlib
import json
import math
from typing import Protocol


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class BgeM3Embedder:
    """Self-hosted BGE-M3 via sentence-transformers (pip install sentence-transformers).
    Loads the model once per process; run it in the indexing worker and the API
    process, or put it behind a small embedding service when you scale."""

    dim = 1024

    def __init__(self, model_name: str = "BAAI/bge-m3", device: str | None = None):
        from sentence_transformers import SentenceTransformer  # heavy import, lazy

        self._model = SentenceTransformer(model_name, device=device)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vecs = self._model.encode(texts, batch_size=16, normalize_embeddings=True)
        return [v.tolist() for v in vecs]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


class BedrockEmbedder:
    """Hosted embeddings from Amazon Bedrock, so the API server needs no model in memory
    (~200 MB of RAM instead of ~3 GB for BGE-M3).

    Two model families:
      * cohere.embed-multilingual-v3 / cohere.embed-v4:0  (Tamil is a supported language;
        documents and questions are embedded differently, which helps retrieval)
      * amazon.titan-embed-text-v2:0                      (Amazon's own; no Marketplace step)
    Vectors from different models live in different spaces: changing the model means a new
    Qdrant collection and a re-index (RagSettings does the renaming).
    """

    COHERE_BATCH = 96            # Bedrock's limit on texts per Cohere call
    COHERE_MAX_CHARS = 2048      # ...and on characters per text

    def __init__(self, model_id: str, dim: int, *, region: str | None = None,
                 access_key_id: str | None = None, secret_access_key: str | None = None, client=None):
        self.model_id, self.dim = model_id, dim
        if not (model_id.startswith("cohere.embed") or model_id.startswith("amazon.titan-embed-text-v2")):
            raise ValueError(f"Unsupported Bedrock embedding model: {model_id}")
        if client is None:
            import boto3
            from botocore.config import Config

            # "adaptive" retries back off on Bedrock's per-minute throttling during a big re-index.
            client = boto3.client("bedrock-runtime", region_name=region, aws_access_key_id=access_key_id,
                                  aws_secret_access_key=secret_access_key,
                                  config=Config(retries={"max_attempts": 8, "mode": "adaptive"}))
        self._client = client

    def _invoke(self, body: dict) -> dict:
        resp = self._client.invoke_model(modelId=self.model_id, body=json.dumps(body),
                                         contentType="application/json", accept="application/json")
        return json.loads(resp["body"].read())

    def _cohere(self, texts: list[str], input_type: str) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), self.COHERE_BATCH):
            body = {"texts": [t[: self.COHERE_MAX_CHARS] for t in texts[i:i + self.COHERE_BATCH]],
                    "input_type": input_type, "truncate": "END"}
            if "embed-v4" in self.model_id:
                body |= {"embedding_types": ["float"], "output_dimension": self.dim}
            vecs = self._invoke(body)["embeddings"]
            out += vecs["float"] if isinstance(vecs, dict) else vecs
        return out

    def _titan(self, texts: list[str]) -> list[list[float]]:
        return [self._invoke({"inputText": t, "dimensions": self.dim, "normalize": True})["embedding"] for t in texts]

    def _embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        if not texts:
            return []
        # Bedrock refuses empty text; a blank chunk still needs a vector to keep the lists aligned.
        texts = [t if t.strip() else "-" for t in texts]
        vecs = self._cohere(texts, input_type) if self.model_id.startswith("cohere.") else self._titan(texts)
        if len(vecs) != len(texts) or any(len(v) != self.dim for v in vecs):
            raise ValueError(f"{self.model_id} returned vectors that don't match EMBEDDING_DIM={self.dim}")
        return vecs

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "search_document")

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text], "search_query")[0]


class FakeEmbedder:
    """Deterministic bag-of-words hashing embedder for tests and offline dev.
    Similar texts share tokens, so retrieval tests are meaningful."""

    def __init__(self, dim: int = 256):
        self.dim = dim

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * self.dim
        for tok in text.lower().split():
            tok = tok.strip(".,;:!?()[]{}\"'")
            if not tok:
                continue
            h = int(hashlib.sha256(tok.encode()).hexdigest(), 16)
            v[h % self.dim] += 1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)


def build_embedder(provider: str, dim: int) -> Embedder:
    if provider == "bge-m3":
        return BgeM3Embedder()
    if provider == "fake":
        return FakeEmbedder(dim)
    if provider == "bedrock":
        from app.rag.config import get_rag_settings

        s = get_rag_settings()
        return BedrockEmbedder(s.bedrock_embedding_model, dim, region=s.bedrock_region,
                               access_key_id=s.aws_access_key_id,
                               secret_access_key=s.aws_secret_access_key.get_secret_value() if s.aws_secret_access_key else None)
    raise ValueError(f"Unknown embedding provider: {provider}")
