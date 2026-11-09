import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { MathText } from "../../components/math/MathText";
import { ApiError, papersApi, type PaperDetail, type PaperSection } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import { papersIn } from "./paperSections";
import "../../styles/practice.css";
import "../../styles/past-papers.css";

// Reads one indexed paper from GET /papers/{id}. The section lives in the URL (?paper=I&part=A&q=4)
// so a section can be linked to, and Back returns to the previous one.

type Status = "loading" | "missing" | "failed" | "ready";

export function PaperReader() {
  const { t } = useLanguage();
  const c = t.dashboard.pastPapers;
  const { uploadId } = useParams();
  const [params, setParams] = useSearchParams();
  const [paper, setPaper] = useState<PaperDetail>();
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setStatus("loading");
    papersApi.read(Number(uploadId)).then(
      (p) => { if (live) { setPaper(p); setStatus("ready"); } },
      (err) => { if (live) setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "failed"); },
    );
    return () => { live = false; };
  }, [uploadId, attempt]);

  const selected = { paper: params.get("paper"), part: params.get("part"), q: params.get("q") };
  const chunks = useMemo(() => (paper?.chunks ?? []).filter((chunk) =>
    (!selected.paper || chunk.paper === selected.paper)
    && (!selected.part || chunk.part === selected.part)
    && (!selected.q || chunk.question === selected.q)),
  [paper, selected.paper, selected.part, selected.q]);

  const back = <Link className="pp-back" to="/dashboard/past-papers">{icons.arrowLeft}{c.back}</Link>;

  if (status !== "ready" || !paper) {
    return (
      <main className="db-content pr-page">
        {back}
        <section className="pr-card pp-state" role={status === "loading" ? "status" : "alert"}>
          {status === "loading" && <p>{c.loading}</p>}
          {status === "missing" && <><h2>{c.notFoundTitle}</h2><p>{c.notFoundText}</p></>}
          {status === "failed" && (
            <>
              <h2>{c.errorTitle}</h2>
              <p>{c.errorText}</p>
              <button type="button" className="db-btn-primary" onClick={() => setAttempt((a) => a + 1)}>{c.retry}</button>
            </>
          )}
        </section>
      </main>
    );
  }

  const go = (next: Record<string, string>) => {
    setParams(next);
    top.current?.scrollIntoView({ block: "start" });
  };
  const isOn = (next: Record<string, string | undefined>) =>
    (next.paper ?? null) === selected.paper && (next.part ?? null) === selected.part && (next.q ?? null) === selected.q;

  const partBlock = (paperName: string | null, section: PaperSection) => {
    const base: Record<string, string> = paperName ? { paper: paperName } : {};
    const part = section.part!;
    return (
      <div key={`${paperName}-${part}`} className="pp-nav-part">
        <button type="button" className={`pp-nav-link pp-nav-sub${isOn({ ...base, part }) ? " active" : ""}`}
          onClick={() => go({ ...base, part })}>{fill(c.part, { n: part })}</button>
        <div className="pp-nav-questions">
          {section.questions.map((q) => (
            <button key={q} type="button" className={`pp-q${isOn({ ...base, part, q }) ? " active" : ""}`}
              aria-label={fill(c.questionLabel, { n: q })} onClick={() => go({ ...base, part, q })}>{q}</button>
          ))}
        </div>
      </div>
    );
  };

  const groups = papersIn(paper);
  const untagged = paper.sections.filter((s) => !s.paper && s.part && s.questions.length);
  const where = (chunk: PaperDetail["chunks"][number]) => [
    chunk.paper && fill(c.paper, { n: chunk.paper }),
    chunk.part && fill(c.part, { n: chunk.part }),
    chunk.question && fill(c.questionLabel, { n: chunk.question }),
    chunk.page && fill(c.page, { n: chunk.page }),
  ].filter(Boolean).join(" · ");

  return (
    <main className="db-content pr-page">
      <div ref={top} className="pp-anchor" />
      {back}
      <header className="pp-reader-head">
        <h1>{fill(c.yearTitle, { year: paper.exam_year ?? "" })}</h1>
        <div className="pp-chips">
          <span>{icons.checks}{c.kinds[paper.upload_type]}</span>
          {paper.language && <span>{icons.globe}{t.dashboard.medium[paper.language]}</span>}
          <span>{icons.doc}{fill(c.pages, { n: paper.pages })}</span>
        </div>
      </header>

      <div className="pp-reader">
        <nav className="pr-card pp-nav" aria-label={c.sectionsTitle}>
          <h2 className="pr-card-title">{c.sectionsTitle}</h2>
          <button type="button" className={`pp-nav-link${isOn({}) ? " active" : ""}`} onClick={() => go({})}>
            {c.wholeDocument}
          </button>
          {groups.map((g) => (
            <div key={g.paper}>
              <button type="button" className={`pp-nav-link${isOn({ paper: g.paper }) ? " active" : ""}`}
                onClick={() => go({ paper: g.paper })}>{fill(c.paper, { n: g.paper })}</button>
              {g.sections.filter((s) => s.part && s.questions.length).map((s) => partBlock(g.paper, s))}
            </div>
          ))}
          {untagged.map((s) => partBlock(null, s))}
        </nav>

        <article className="pr-card pp-text">
          <p className="pp-note pp-note-top">{c.transcribed}</p>
          {chunks.map((chunk) => (
            <section key={chunk.index} className="pp-chunk">
              {where(chunk) && <h3>{where(chunk)}</h3>}
              <MathText text={chunk.text} />
            </section>
          ))}
          {!chunks.length && <p className="pr-muted">{c.nothingHere}</p>}
        </article>
      </div>
    </main>
  );
}
