"""OCR for scanned past papers and marking schemes, using an OpenRouter vision model.

Every KELU past-paper PDF is a scan (no text layer), and the content is
maths-heavy and often Tamil, which classic OCR handles badly. Each page is
rendered to an image and transcribed by the model with maths as LaTeX.

Output is cached one file per page under <ocr_dir>/<canonical stem>/page-NNN.md,
so an interrupted run resumes and nothing is paid for twice. `load_pages`
returns the page list the chunker expects (page numbers survive for citations).

The transcription keeps the layout markers the chunker splits on:
paper headings ("Combined Mathematics I"), "PART A"/"பகுதி A", and question
numbers ("5. ") at the start of a line.
"""
from __future__ import annotations

import base64
import io
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

from .agent.openrouter_llm import OpenRouterLLM

log = logging.getLogger("kelu.ocr")

PROMPT = """Transcribe this scanned page of a Sri Lankan G.C.E. A/L Combined Mathematics \
exam paper or marking scheme. It may be in English or Tamil.

Rules:
- Output only the transcription, no commentary.
- Keep the original language. Do not translate.
- Write all mathematics as LaTeX inside $...$ (inline) or $$...$$ (display).
- Keep paper headings exactly, e.g. "Combined Mathematics I", "இணைந்த கணிதம் II".
- Keep part headings on their own line, e.g. "PART A", "Part B", "பகுதி B".
- Start every question on a new line with its number, e.g. "5. Let ...", "11. (a) ...".
  Keep sub-parts like (a), (b), (i), (ii).
- Describe figures briefly in [Figure: ...], including any labelled lengths or angles.
- In marking schemes keep the marks, e.g. (5), (10).
- Skip the empty dotted answer lines, the examiners' marks table, index-number boxes,
  "All Rights Reserved" banners, and "see page N" footers.
- If the page is blank, output nothing."""

RETRIES = 6     # free / busy models answer 429 or 5xx; back off and try again


def _render_pages(pdf_path: Path, scale: float = 2.0) -> list[bytes]:
    import pypdfium2 as pdfium  # lazy: only needed when OCR runs

    pdf = pdfium.PdfDocument(str(pdf_path))
    out = []
    for page in pdf:
        img = page.render(scale=scale).to_pil().convert("L")   # greyscale scan
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        out.append(buf.getvalue())
    return out


def openrouter_transcriber(llm: OpenRouterLLM, model: str) -> Callable[[bytes], str]:
    def transcribe(jpeg: bytes) -> str:
        messages = [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {
                "url": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()}},
        ]}]
        for attempt in range(RETRIES):
            try:
                resp = llm.complete_raw(model=model, max_tokens=4096, messages=messages)
                break
            except RuntimeError as e:
                transient = any(f"OpenRouter {c}" in str(e) for c in (429, 500, 502, 503))
                if not transient or attempt == RETRIES - 1:
                    raise
                time.sleep(min(60, 5 * 2 ** attempt))
        return "".join(b.text for b in resp.content if b.type == "text").strip()
    return transcribe


def ocr_pdf(pdf_path: Path, out_dir: Path, transcribe: Callable[[bytes], str], *,
            workers: int = 4, pages: list[int] | None = None) -> int:
    """OCR every page not already cached (or only `pages`, 1-based). Returns
    the number of pages transcribed now."""
    out_dir.mkdir(parents=True, exist_ok=True)
    images = _render_pages(pdf_path)
    todo = [i for i in range(len(images)) if not (out_dir / f"page-{i + 1:03d}.md").exists()
            and (pages is None or i + 1 in pages)]
    if not todo:
        return 0

    def work(i: int) -> None:
        text = transcribe(images[i])
        (out_dir / f"page-{i + 1:03d}.md").write_text(text, encoding="utf-8")
        log.info("%s page %d/%d", pdf_path.name, i + 1, len(images))

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(work, todo))      # list() re-raises the first worker error
    return len(todo)


def extract_text_pages(pdf_path: Path, out_dir: Path, min_chars: int = 200) -> int:
    """No-LLM alternative for PDFs that already have a text layer: write each
    page's embedded text to the same cache OCR uses, so `ingest` is unchanged.
    Maths often comes out flattened (fractions, limits), so OCR is still better;
    this is for quick testing. Returns pages written; 0 if the PDF is a scan."""
    from pypdf import PdfReader

    from .tamil_text import normalize_tamil

    # Tamil text layers usually come out in visual order (ை before its consonant): repair it.
    texts = [normalize_tamil((p.extract_text() or "").strip()) for p in PdfReader(str(pdf_path)).pages]
    if sum(len(t) >= min_chars for t in texts) < len(texts) // 2:
        return 0                                    # mostly scanned: needs real OCR
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, t in enumerate(texts, start=1):
        (out_dir / f"page-{i:03d}.md").write_text(t, encoding="utf-8")
    return len(texts)


def load_pages(out_dir: Path) -> list[str] | None:
    files = sorted(out_dir.glob("page-*.md"))
    return [f.read_text(encoding="utf-8") for f in files] if files else None
