import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { icons } from "../dashboard/icons";
import { loadError } from "./loadError";
import { ApiError, adminApi, type KbDocument, type KbJob, type KbOverview, type KbType, type Medium } from "../../services/api";
import "../../styles/admin-students.css";
import "../../styles/admin-billing.css";
import "../../styles/admin-library.css";

// Admin > Knowledge Base: the shared documents the AI tutor searches and cites (read from Qdrant).
// Adding a file runs text extraction (or AI OCR for scans), indexing and topic tagging as a
// background job; this page polls while a job runs.

const TYPE_LABEL: Record<KbType, string> = { past_paper: "Past paper", marking_scheme: "Marking scheme", syllabus: "Notes / syllabus" };
const LANG_LABEL: Record<Medium, string> = { en: "English", ta: "Tamil" };
type Filter = "all" | KbType;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "past_paper", label: "Past papers" },
  { key: "marking_scheme", label: "Marking schemes" }, { key: "syllabus", label: "Notes" },
];
const POLL_MS = 3000;
const num = (n: number) => n.toLocaleString("en-LK");

function Tile({ icon, tone, label, value, sub }: { icon: ReactNode; tone: string; label: string; value: string; sub?: string }) {
  return (
    <article className="ad-kpi">
      <div className="ad-kpi-top">
        <span className={`ad-badge ${tone}`}>{icon}</span>
        <div><h3>{label}</h3><strong className="ad-kpi-value">{value}</strong></div>
      </div>
      {sub && <p className="ad-kpi-change ad-muted">{sub}</p>}
    </article>
  );
}

function Uploader({ busy, onStarted }: { busy: boolean; onStarted: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Medium>("en");
  const [over, setOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const send = async (file: File | undefined) => {
    if (!file) return;
    setSending(true);
    setError(undefined);
    try {
      await adminApi.uploadKb(file, lang);
      onStarted();
    } catch (err) {
      const message = err instanceof ApiError ? (err.detail as { message?: string } | undefined)?.message : undefined;
      setError(message || "The upload failed. Please try again.");
    }
    setSending(false);
    if (input.current) input.current.value = "";
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!busy && !sending) send(e.dataTransfer.files[0]);
  };

  return (
    <section className="ad-card ad-kb-upload" aria-labelledby="ad-kb-add">
      <h2 id="ad-kb-add" className="ad-card-title">Add a document</h2>
      <div className={`ad-kb-drop${over ? " over" : ""}${busy || sending ? " off" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
        <span className="ad-kb-drop-icon" aria-hidden="true">{icons.doc}</span>
        <p><strong>Drop a PDF or text file here</strong> or</p>
        <button type="button" className="db-btn-primary" disabled={busy || sending} onClick={() => input.current?.click()}>
          {sending ? "Uploading…" : "Choose a file"}
        </button>
        <input ref={input} type="file" accept=".pdf,.txt,.md" hidden onChange={(e) => send(e.target.files?.[0])} />
        {busy && <small className="ad-muted">A document is being processed. You can add the next one when it finishes.</small>}
      </div>
      {error && <p className="ad-bank-warn" role="alert">{error}</p>}
      <details className="ad-kb-help">
        <summary>How to name past papers</summary>
        <p>PDFs must follow <code>&lt;year&gt; combinedmaths &lt;full|pure|applied&gt; &lt;EM|TM&gt; [Msch]</code>, for example:</p>
        <ul>
          <li><code>2023_combinedmaths_full_EM.pdf</code>: 2023 question paper, English medium</li>
          <li><code>2023_combinedmaths_full_TM_Msch.pdf</code>: its Tamil-medium marking scheme</li>
          <li><code>2021_combinedmaths_pure_EM.pdf</code>: Paper I only</li>
        </ul>
        <p>Uploading the same paper again replaces it. Scanned PDFs are read page by page by the AI (OCR), which uses the
          OpenRouter key and takes a few minutes.</p>
      </details>
      <label className="ad-bl-field ad-kb-lang">
        <span className="ad-bl-label">Medium of .txt / .md notes <small>(PDF names already say it)</small></span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Medium)}>
          <option value="en">English</option><option value="ta">Tamil</option>
        </select>
      </label>
    </section>
  );
}

function Jobs({ jobs }: { jobs: KbJob[] }) {
  if (!jobs.length) return null;
  return (
    <section className="ad-card" aria-labelledby="ad-kb-jobs">
      <h2 id="ad-kb-jobs" className="ad-card-title">Recent jobs</h2>
      <ul className="ad-kb-jobs">
        {jobs.map((j) => (
          <li key={j.id} className={j.status}>
            <span className="ad-kb-job-dot" aria-hidden="true" />
            <div>
              <strong>{j.kind === "retag" ? "Update topic tags" : j.filename}</strong>
              <small>
                {j.stage}
                {j.status === "done" && j.chunk_count != null && ` · ${num(j.chunk_count)} ${j.kind === "retag" ? "tags" : "chunks"}`}
              </small>
              {j.message && <small className="ad-kb-job-error">{j.message}</small>}
            </div>
            <span className={`ad-pill ad-kb-${j.status}`}>
              {{ queued: "Waiting", running: "Working…", done: "Done", failed: "Failed" }[j.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfirmRemove({ doc, onClose, onRemoved }: { doc: KbDocument; onClose: () => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const remove = async () => {
    setBusy(true);
    try {
      await adminApi.removeKb(doc.upload_id);
      onRemoved();
    } catch {
      setError(true);
      setBusy(false);
    }
  };
  return (
    <div className="ad-st-modal-scrim" onMouseDown={onClose}>
      <div className="ad-st-modal ad-bl-modal" role="dialog" aria-modal="true" aria-labelledby="ad-kb-rm" onMouseDown={(e) => e.stopPropagation()}>
        <span className="ad-st-modal-icon">{icons.trash}</span>
        <h2 id="ad-kb-rm">Remove “{doc.title}”?</h2>
        <p>Its {num(doc.chunk_count)} chunks leave the vector database, so the tutor stops citing it and students no
          longer see it in Past Papers. Upload the file again to bring it back.</p>
        {error && <p className="ad-bank-warn" role="alert">That didn't work. Please try again.</p>}
        <div className="ad-st-modal-foot">
          <button type="button" className="db-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="ad-st-btn danger" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Remove"}</button>
        </div>
      </div>
    </div>
  );
}

export function AdminKnowledgeBase() {
  const [data, setData] = useState<KbOverview>();
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<KbDocument | null>(null);
  const [retagError, setRetagError] = useState(false);

  const load = useCallback(() => {
    adminApi.knowledgeBase().then((d) => { setData(d); setFailed(null); },
      (err) => setFailed(loadError(err, "Couldn't reach the vector database. Check that Qdrant is running on port 6333.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const busy = !!data?.jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [busy, load]);

  const docs = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.documents ?? []).filter((d) => (filter === "all" || d.upload_type === filter)
      && (!term || `${d.title} ${d.exam_year ?? ""}`.toLowerCase().includes(term)));
  }, [data, filter, q]);

  const retag = async () => {
    setRetagError(false);
    try {
      await adminApi.retagKb();
      load();
    } catch {
      setRetagError(true);
    }
  };

  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Knowledge Base</h1>
          <p>Past papers, marking schemes and notes the AI tutor searches and cites.</p>
        </div>
        <button type="button" className="db-btn-outline" disabled={busy || !data} onClick={retag}
          title="Re-match every past-paper chunk to the syllabus topics">
          {icons.layers}Update topic tags
        </button>
      </div>
      {retagError && <p className="ad-bank-warn" role="alert">Couldn't start the topic update. Is another job running?</p>}

      {failed ? (
        <section className="ad-card" role="alert">
          <p className="ad-pad ad-muted">{failed}</p>
          <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
        </section>
      ) : !data ? (
        <section className="ad-card" role="status"><p className="ad-pad ad-muted">Loading…</p></section>
      ) : (
        <>
          <div className="ad-kpis ad-kb-kpis">
            <Tile icon={icons.doc} tone="plum" label="Documents" value={num(data.totals.documents)}
              sub={`${data.totals.by_type.past_paper} papers · ${data.totals.by_type.marking_scheme} schemes · ${data.totals.by_type.syllabus} notes`} />
            <Tile icon={icons.database} tone="amber" label="Chunks indexed" value={num(data.totals.chunks)} sub={`Collection ${data.collection}`} />
            <Tile icon={icons.calendar} tone="coral" label="Exam years" value={num(data.totals.years)} />
            <Tile icon={icons.globe} tone="plum" label="By medium"
              value={`${data.totals.by_language.en} EN · ${data.totals.by_language.ta} TA`} />
          </div>

          <div className="ad-kb-top">
            <Uploader busy={busy} onStarted={load} />
            <Jobs jobs={data.jobs} />
          </div>

          <section className="ad-card" aria-labelledby="ad-kb-docs">
            <div className="ad-kb-docs-head">
              <h2 id="ad-kb-docs" className="ad-card-title">Indexed documents</h2>
              <div className="ad-kb-tools">
                <div className="ad-kb-tabs" role="tablist" aria-label="Document type">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
                      className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
                <input type="search" className="ad-kb-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title or year" aria-label="Search documents" />
              </div>
            </div>
            {docs.length ? (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr><th>Document</th><th>Type</th><th>Year</th><th>Medium</th>
                      <th className="ad-num">Pages</th><th className="ad-num">Chunks</th><th><span className="ad-st-sr">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.upload_id}>
                        <td><strong>{d.title ?? `Document ${d.upload_id}`}</strong><small className="ad-kb-id">#{d.upload_id}</small></td>
                        <td><span className={`ad-pill ad-kb-type ${d.upload_type}`}>{TYPE_LABEL[d.upload_type]}</span></td>
                        <td>{d.exam_year ?? "—"}</td>
                        <td>{d.language ? LANG_LABEL[d.language] : "—"}</td>
                        <td className="ad-num">{d.pages || "—"}</td>
                        <td className="ad-num">{num(d.chunk_count)}</td>
                        <td className="ad-num">
                          <button type="button" className="ad-kb-remove" aria-label={`Remove ${d.title}`} disabled={busy}
                            onClick={() => setRemoving(d)}>{icons.trash}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ad-pad ad-muted">{data.documents.length ? "No document matches." : "Nothing indexed yet. Add a past paper above."}</p>
            )}
          </section>
        </>
      )}
      {removing && <ConfirmRemove doc={removing} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); load(); }} />}
    </main>
  );
}
