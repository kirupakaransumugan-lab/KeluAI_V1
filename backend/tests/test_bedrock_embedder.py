"""Bedrock embeddings, against a fake bedrock-runtime client (no AWS calls)."""
import io
import json

import pytest

from app.rag.config import RagSettings
from app.rag.embeddings import BedrockEmbedder


class FakeBedrock:
    def __init__(self, dim):
        self.dim, self.calls = dim, []

    def invoke_model(self, modelId, body, contentType, accept):
        req = json.loads(body)
        self.calls.append((modelId, req))
        if modelId.startswith("cohere."):
            out = {"embeddings": [[0.1] * self.dim for _ in req["texts"]]}
        else:
            out = {"embedding": [0.1] * self.dim}
        return {"body": io.BytesIO(json.dumps(out).encode())}


def test_cohere_batches_and_marks_documents_vs_questions():
    fake = FakeBedrock(8)
    emb = BedrockEmbedder("cohere.embed-multilingual-v3", 8, client=fake)
    vecs = emb.embed_documents([f"chunk {i}" for i in range(100)] + ["x" * 5000])
    assert len(vecs) == 101
    assert [len(req["texts"]) for _, req in fake.calls] == [96, 5]            # Bedrock's 96-text limit
    assert all(req["input_type"] == "search_document" for _, req in fake.calls)
    assert len(fake.calls[1][1]["texts"][-1]) == 2048                        # long chunk clipped, not refused
    emb.embed_query("தொகையிடல்")
    assert fake.calls[-1][1]["input_type"] == "search_query"


def test_titan_sends_one_text_per_call_with_the_dimension():
    fake = FakeBedrock(256)
    emb = BedrockEmbedder("amazon.titan-embed-text-v2:0", 256, client=fake)
    assert len(emb.embed_documents(["a", "  "])) == 2
    assert [req for _, req in fake.calls] == [{"inputText": "a", "dimensions": 256, "normalize": True},
                                             {"inputText": "-", "dimensions": 256, "normalize": True}]


def test_a_dimension_mismatch_is_a_clear_error():
    emb = BedrockEmbedder("cohere.embed-multilingual-v3", 1024, client=FakeBedrock(512))
    with pytest.raises(ValueError, match="EMBEDDING_DIM"):
        emb.embed_query("x")


def test_unknown_models_are_refused():
    with pytest.raises(ValueError):
        BedrockEmbedder("meta.llama3", 1024, client=FakeBedrock(1024))


def test_bedrock_gets_its_own_collection_unless_one_is_named():
    assert RagSettings(_env_file=None, embedding_provider="bedrock").vector_collection == \
        "kelu_chunks_cohere_embed_multilingual_v3_1024"
    assert RagSettings(_env_file=None, embedding_provider="bedrock", vector_collection="mine").vector_collection == "mine"
    assert RagSettings(_env_file=None).vector_collection == "kelu_chunks_v1"
