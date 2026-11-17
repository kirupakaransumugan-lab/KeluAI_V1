"""Server-side admin tasks that must not be reachable over HTTP.

    python -m app.manage make-admin student@example.com
    python -m app.manage tag-topics
    python -m app.manage check-aws          # S3 + Bedrock reachable with the keys in .env? (prints no secrets)
    python -m app.manage push-ocr-cache     # copy var/ocr page text to S3 so the server never re-pays for OCR

Run from backend/ so .env is found. The account must already exist (sign up
first); after that, this admin can promote others via PATCH /api/v1/admin/users/{id}/role.
"""
import argparse
import pathlib
import sys

from app.core.database import SessionLocal
from app.models.user import Role
from app.repositories import user_repository


def make_admin(email: str) -> None:
    with SessionLocal() as db:
        user = user_repository.get_by_email(db, email)
        if user is None:
            sys.exit(f"No account with email {email}. Sign up first, then run this again.")
        user.role = Role.admin
        db.commit()
        print(f"{user.email} (id {user.id}) is now an admin.")


def tag_topics() -> None:
    """Write topic ids into the chunks' `topic_ids` in Qdrant. Run after any ingest. No AI requests."""
    from sqlalchemy import update

    from app.models.topic import SyllabusTopic
    from app.rag.config import get_rag_settings
    from app.rag.embeddings import build_embedder
    from app.rag.vector_store import VectorStore
    from app.services.topic_tags import tag_chunks
    from app.services.topics import by_id

    s = get_rag_settings()
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    store = VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, embedder.dim)
    store.ensure_collection()
    counts = tag_chunks(store, embedder, s.retrieval_min_score)
    with SessionLocal() as db:
        for topic_id, n in counts.items():
            db.execute(update(SyllabusTopic).where(SyllabusTopic.id == topic_id).values(chunk_count=n))
        db.commit()
    for topic_id, n in counts.items():
        print(f"{by_id(topic_id).en}: {n} chunks")


def _s3():
    """The S3 bucket from .env, whatever STORAGE_BACKEND says (these commands are for setting it up)."""
    from app.core.config import get_settings
    from app.services.file_storage import S3Storage

    s = get_settings()
    if not s.s3_bucket:
        sys.exit("S3_BUCKET is not set in backend/.env.")
    secret = s.aws_secret_access_key.get_secret_value() if s.aws_secret_access_key else None
    return S3Storage(s.s3_bucket, region=s.s3_region, endpoint_url=s.s3_endpoint_url,
                     access_key_id=s.aws_access_key_id, secret_access_key=secret), s


def check_aws() -> None:
    from app.rag.config import get_rag_settings
    from app.rag.embeddings import BedrockEmbedder

    store, s = _s3()
    key = "healthcheck/check-aws.txt"
    try:
        store.put(key, "KELU ✓ தமிழ்".encode(), "text/plain; charset=utf-8")
        assert store.get(key) == "KELU ✓ தமிழ்".encode()
        assert key in store.list("healthcheck/")
        store.delete(key)
        assert key not in store.list("healthcheck/")
        print(f"S3      OK   bucket {s.s3_bucket} ({s.s3_region}): upload, read, list, delete")
    except Exception as e:
        print(f"S3      FAIL {type(e).__name__}: {e}")

    r = get_rag_settings()
    secret = r.aws_secret_access_key.get_secret_value() if r.aws_secret_access_key else None
    try:
        emb = BedrockEmbedder(r.bedrock_embedding_model, r.embedding_dim, region=r.bedrock_region,
                              access_key_id=r.aws_access_key_id, secret_access_key=secret)
        en, ta = emb.embed_documents(["Integration by parts", "பகுதிகளாகத் தொகையிடல்"])
        cos = sum(a * b for a, b in zip(en, ta)) / (sum(a * a for a in en) ** .5 * sum(b * b for b in ta) ** .5)
        print(f"Bedrock OK   {r.bedrock_embedding_model} ({r.bedrock_region}): {len(en)}-dim, "
              f"English-Tamil similarity {cos:.2f}")
    except Exception as e:
        print(f"Bedrock FAIL {type(e).__name__}: {e}")


def push_ocr_cache() -> None:
    """var/ocr/<paper>/page-NNN.md -> s3://bucket/ocr/<paper>/page-NNN.md (skips pages already there)."""
    from app.rag.config import get_rag_settings

    store, s = _s3()
    root = pathlib.Path(get_rag_settings().ocr_dir)
    done = set(store.list("ocr/"))
    sent = 0
    for page in sorted(root.glob("*/page-*.md")):
        key = f"ocr/{page.parent.name}/{page.name}"
        if key not in done:
            store.put(key, page.read_bytes(), "text/markdown; charset=utf-8")
            sent += 1
    print(f"{sent} new pages copied to s3://{s.s3_bucket}/ocr/ ({len(done)} were already there).")


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.manage")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("make-admin", help="promote an existing account to admin")
    sp.add_argument("email")
    sub.add_parser("tag-topics", help="write topic ids into the chunks in Qdrant (run after any ingest)")
    sub.add_parser("check-aws", help="check the S3 bucket and Bedrock embeddings with the keys in .env")
    sub.add_parser("push-ocr-cache", help="copy the local OCR page cache (var/ocr) to S3")
    args = ap.parse_args()
    if args.cmd == "make-admin":
        make_admin(args.email)
    elif args.cmd == "tag-topics":
        tag_topics()
    elif args.cmd == "check-aws":
        check_aws()
    elif args.cmd == "push-ocr-cache":
        push_ocr_cache()


if __name__ == "__main__":
    main()
