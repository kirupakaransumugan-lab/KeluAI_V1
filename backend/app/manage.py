"""Server-side admin tasks that must not be reachable over HTTP.

    python -m app.manage make-admin student@example.com
    python -m app.manage tag-topics

Run from backend/ so .env is found. The account must already exist (sign up
first); after that, this admin can promote others via PATCH /api/v1/admin/users/{id}/role.
"""
import argparse
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


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.manage")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("make-admin", help="promote an existing account to admin")
    sp.add_argument("email")
    sub.add_parser("tag-topics", help="write topic ids into the chunks in Qdrant (run after any ingest)")
    args = ap.parse_args()
    if args.cmd == "make-admin":
        make_admin(args.email)
    elif args.cmd == "tag-topics":
        tag_topics()


if __name__ == "__main__":
    main()
