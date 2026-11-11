"""Local CLI: run the RAG pipeline on a folder of past papers, without MySQL.

    python -m app.rag.cli ocr     ../../KeluPDF        # scanned PDFs -> var/ocr/ (OpenRouter vision)
    python -m app.rag.cli extract ../../KeluPDF        # text-layer PDFs -> var/ocr/ (no LLM)
    python -m app.rag.cli ingest  ../../KeluPDF        # var/ocr/ -> chunks -> Qdrant
    python -m app.rag.cli ingest-text ../../KeluText   # .txt/.md files -> chunks -> Qdrant
    python -m app.rag.cli ask --lang en                # chat with the tutor
    python -m app.rag.cli stats

Files must follow the naming convention in app/rag/filenames.py. Every file
is indexed as a global (admin) knowledge-base document. Run from backend/ so
.env is found. Needs OPENROUTER_API_KEY (ocr, ask) and Qdrant running (ingest, ask).
"""
from __future__ import annotations

import argparse
import logging
import sys
import zlib
from pathlib import Path

from app.rag.config import get_rag_settings
from app.rag.embeddings import build_embedder
from app.rag.filenames import FilenameError, ParsedPaperName, parse_kb_filename
from app.rag.ingestion import NotIndexable, index_upload
from app.rag.ocr import extract_text_pages, load_pages, ocr_pdf, openrouter_transcriber
from app.rag.types import AccessScope, TutorMode, UploadRecord
from app.rag.vector_store import VectorStore

ADMIN_USER_ID = 0       # owner of global library files in CLI mode
STUDENT_USER_ID = 1     # who is "asking" in CLI mode


def upload_id_for(p: ParsedPaperName) -> int:
    """Stable integer id for a library file, so re-ingesting replaces its chunks
    instead of duplicating them (Qdrant point ids derive from upload_id).

    Readable and collision-free: 90 YYYY M K C (medium, kind, coverage),
    e.g. 2016 EN full question paper -> 902016101, its marking scheme -> 902016111.
    The 9xxxxxxxx range keeps these far above real auto-increment uploads ids."""
    medium = {"en": 1, "ta": 2}[p.language]
    kind = 1 if p.upload_type == "marking_scheme" else 0
    coverage = {"full": 1, "pure": 2, "applied": 3}[p.paper_coverage]
    return 900_000_000 + p.exam_year * 1000 + medium * 100 + kind * 10 + coverage


def text_upload_id(path: Path) -> int:
    """Stable id for a text document, keyed by file name, so re-ingesting an
    edited file replaces its chunks. 8xxxxxxxx keeps clear of paper ids (9xx...)."""
    return 800_000_000 + zlib.crc32(path.name.lower().encode()) % 100_000_000


def _papers(folder: Path) -> list[tuple[Path, ParsedPaperName]]:
    out = []
    for pdf in sorted(folder.rglob("*.pdf")):
        try:
            out.append((pdf, parse_kb_filename(pdf.name)))
        except FilenameError as e:
            print(f"skip  {pdf.name}: {e}")
    return out


def _selected(args, folder: str) -> list[tuple[Path, ParsedPaperName]]:
    return [(pdf, p) for pdf, p in _papers(Path(folder))
            if not (args.year and p.exam_year != args.year)
            and not (args.only and args.only not in pdf.name)]


def _ocr_dir(p: ParsedPaperName) -> Path:
    return Path(get_rag_settings().ocr_dir) / Path(p.canonical_name).stem


def _llm(purpose: str = "other"):
    from app.rag.agent.tutor_agent import LLMNotConfigured, build_llm

    s = get_rag_settings()
    try:
        return build_llm(s.openrouter_api_key, s.openrouter_base_url, purpose=purpose)
    except LLMNotConfigured as e:
        sys.exit(f"{e}. Add it to backend/.env yourself (see the README).")


def store_for(embedder) -> VectorStore:
    s = get_rag_settings()
    store = VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, embedder.dim)
    store.ensure_collection()
    return store


def cmd_ocr(args) -> None:
    s = get_rag_settings()
    transcribe = openrouter_transcriber(_llm("ocr"), s.ocr_model)
    for pdf, p in _selected(args, args.folder):
        n = ocr_pdf(pdf, _ocr_dir(p), transcribe, workers=s.ocr_workers, pages=args.pages)
        print(f"{'ocr ' if n else 'done'}  {pdf.name}" + (f" ({n} pages)" if n else ""))


def cmd_extract(args) -> None:
    for pdf, p in _selected(args, args.folder):
        n = extract_text_pages(pdf, _ocr_dir(p))
        print(f"text  {pdf.name} ({n} pages)" if n else f"scan  {pdf.name}: no text layer, needs ocr")


def cmd_ingest(args) -> None:
    s = get_rag_settings()
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    store = store_for(embedder)
    for pdf, p in _selected(args, args.folder):
        pages = load_pages(_ocr_dir(p))
        if not pages:
            print(f"skip  {pdf.name}: not OCR'd yet (run the ocr command)")
            continue
        rec = UploadRecord(
            upload_id=upload_id_for(p), user_id=ADMIN_USER_ID, upload_type=p.upload_type,
            visibility="global", language=p.language, title=p.title, exam_year=p.exam_year,
            text="\f".join(pages), pages=pages, paper_coverage=p.paper_coverage,
        )
        try:
            res = index_upload(rec, store, embedder, max_chars=s.chunk_max_chars, overlap=s.chunk_overlap_chars)
            print(f"index {pdf.name}: {res.chunk_count} chunks (upload_id {rec.upload_id})")
        except NotIndexable as e:
            print(f"skip  {pdf.name}: {e}")


def cmd_ingest_text(args) -> None:
    s = get_rag_settings()
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    store = store_for(embedder)
    files = sorted(f for ext in ("*.txt", "*.md") for f in Path(args.folder).rglob(ext))
    if not files:
        sys.exit(f"no .txt or .md files in {args.folder}")
    for f in files:
        text = f.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
        rec = UploadRecord(
            upload_id=text_upload_id(f), user_id=ADMIN_USER_ID, upload_type="syllabus", visibility="global",
            language=args.lang, title=f.stem, exam_year=None, text=text,
            pages=text.split("\f") if "\f" in text else None,
        )
        try:
            res = index_upload(rec, store, embedder, max_chars=s.chunk_max_chars, overlap=s.chunk_overlap_chars)
            print(f"index {f.name}: {res.chunk_count} chunks (upload_id {rec.upload_id})")
        except NotIndexable as e:
            print(f"skip  {f.name}: {e}")


def cmd_stats(args) -> None:
    s = get_rag_settings()
    store = VectorStore.from_url(s.vector_db_url, s.vector_db_api_key, s.vector_collection, s.embedding_dim)
    if not store.client.collection_exists(s.vector_collection):
        sys.exit(f"collection '{s.vector_collection}' does not exist yet; run ingest")
    print(f"{s.vector_collection}: {store.client.count(s.vector_collection, exact=True).count} chunks")


def cmd_ask(args) -> None:
    from app.rag.agent.tutor_agent import TutorAgent
    from app.rag.retrieval import Retriever

    s = get_rag_settings()
    llm = _llm("tutor")
    embedder = build_embedder(s.embedding_provider, s.embedding_dim)
    retriever = Retriever(store_for(embedder), embedder, top_k=s.retrieval_top_k, min_score=s.retrieval_min_score)
    agent = TutorAgent(llm, retriever, model=s.llm_model,
                       max_rounds=s.agent_max_tool_rounds, max_tokens=s.agent_max_output_tokens,
                       search_first=s.agent_search_first)
    scope, mode = AccessScope(STUDENT_USER_ID), TutorMode(args.mode)
    history: list[dict] = []
    print(f"KELU tutor ({mode.value}, {args.lang}, {s.llm_model}). Empty line to quit.")
    while True:
        try:
            q = input("\nyou> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            break
        history.append({"role": "user", "content": q})
        res = agent.reply(scope=scope, mode=mode, language=args.lang, history=history[-20:])
        history.append({"role": "assistant", "content": res.content})
        print(f"\nkelu> {res.content}")
        for src in res.sources:
            where = " ".join(str(x) for x in (src["paper"] and f"Paper {src['paper']}",
                                              src["paper_part"] and f"Part {src['paper_part']}",
                                              src["question_number"] and f"Q{src['question_number']}",
                                              src["page"] and f"p.{src['page']}") if x)
            print(f"  [{src['label']}] {src['title']} — {where}")
        if args.verbose:
            print(f"  tools: {res.tool_calls}  tokens: {res.tokens_used}")


def _page_range(text: str) -> list[int]:
    """'1-6' -> [1..6]; '1,3,5' -> [1, 3, 5]."""
    out: list[int] = []
    for part in text.split(","):
        lo, _, hi = part.strip().partition("-")
        out.extend(range(int(lo), int(hi or lo) + 1))
    return out


def main() -> None:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser(prog="python -m app.rag.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("ocr", cmd_ocr), ("extract", cmd_extract), ("ingest", cmd_ingest)):
        sp = sub.add_parser(name)
        sp.add_argument("folder")
        sp.add_argument("--year", type=int, help="only this exam year")
        sp.add_argument("--only", help="only files whose name contains this text")
        if name == "ocr":
            sp.add_argument("--pages", type=_page_range, help="only these pages, e.g. 1-6 (Paper I Part A)")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser("ingest-text", help="index .txt/.md documents (no OCR, no naming convention)")
    sp.add_argument("folder")
    sp.add_argument("--lang", choices=["en", "ta"], default="en")
    sp.set_defaults(fn=cmd_ingest_text)
    sp = sub.add_parser("ask")
    sp.add_argument("--lang", choices=["en", "ta"], default="en")
    sp.add_argument("--mode", choices=[m.value for m in TutorMode], default="practice")
    sp.add_argument("-v", "--verbose", action="store_true")
    sp.set_defaults(fn=cmd_ask)
    sub.add_parser("stats").set_defaults(fn=cmd_stats)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
