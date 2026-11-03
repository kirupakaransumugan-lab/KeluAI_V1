"""Embedding providers behind one small interface.

Provider choice is an open decision. Requirements for KELU:
  * Tamil + English in the same vector space (a Tamil question must find an
    English-medium marking scheme for the same paper and vice versa).
  * Tolerates LaTeX / maths tokens.
Default: BGE-M3 (open weights, 1024-dim, multilingual incl. Tamil, self-hosted).
Swap in a hosted model by adding a class with the same two methods.
"""
from __future__ import annotations

import hashlib
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
    raise ValueError(f"Unknown embedding provider: {provider}")
