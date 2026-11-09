import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { papersApi, type PaperSummary } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import { papersIn, questionCount } from "./paperSections";
import "../../styles/practice.css";
import "../../styles/past-papers.css";

// Lists what is really indexed in the RAG (GET /papers): no year, count or paper appears here
// unless Qdrant has it. There is no progress table and chunks carry no topics yet, so the
// mockup's progress ring and topic browsing wait for those instead of showing made-up numbers.

type Tab = "papers" | "schemes";

function yearsOf(papers: PaperSummary[]): number[] {
  return [...new Set(papers.flatMap((p) => (p.exam_year ? [p.exam_year] : [])))];
}

export function PastPapersPage() {
  const { t } = useLanguage();
  const c = t.dashboard.pastPapers;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [papers, setPapers] = useState<PaperSummary[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("papers");

  useEffect(() => {
    let live = true;
    setFailed(false);
    papersApi.list().then((r) => { if (live) setPapers(r.papers); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [attempt]);

  const years = useMemo(() => yearsOf(papers ?? []), [papers]);
  const requested = Number(params.get("year"));
  const year = years.includes(requested) ? requested : years[0];   // the year stays in the URL for Back
  const inYear = (papers ?? []).filter((p) => p.exam_year === year);
  const schemes = (papers ?? []).filter((p) => p.upload_type === "marking_scheme");

  const hero = (
    <header className="pr-hero pp-hero">
      <span className="pp-hero-icon">{icons.paper}</span>
      <div className="pr-hero-copy">
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
      </div>
      <img className="pr-hero-art pp-hero-art" src="/dashboard/bear-reading.png" alt="" />
    </header>
  );

  if (failed || !papers || !papers.length) {
    return (
      <main className="db-content pr-page">
        {hero}
        <section className="pr-card pp-state" role={failed ? "alert" : "status"}>
          {failed ? (
            <>
              <h2>{c.errorTitle}</h2>
              <p>{c.errorText}</p>
              <button type="button" className="db-btn-primary" onClick={() => setAttempt((a) => a + 1)}>{c.retry}</button>
            </>
          ) : papers ? (
            <>
              <h2>{c.emptyTitle}</h2>
              <p>{c.emptyText}</p>
            </>
          ) : <p>{c.loading}</p>}
        </section>
      </main>
    );
  }

  const medium = (p: PaperSummary) => (p.language ? t.dashboard.medium[p.language] : null);
  const kind = (p: PaperSummary) => c.kinds[p.upload_type];
  const pages = (p: PaperSummary) => fill(c.pages, { n: p.pages });
  const openRandom = () => navigate(`${papers[Math.floor(Math.random() * papers.length)].upload_id}`);

  const paperNames = (p: PaperSummary) => papersIn(p).map((g) => fill(c.paper, { n: g.paper })).join(" · ");
  const hasQuestionPaper = inYear.some((p) => p.upload_type === "past_paper");

  return (
    <main className="db-content pr-page">
      {hero}

      <nav className="pr-tabs" aria-label={c.title}>
        <button type="button" className={`pr-tab${tab === "papers" ? " active" : ""}`} aria-pressed={tab === "papers"}
          onClick={() => setTab("papers")}>{icons.paper}{c.tabs.papers}</button>
        <button type="button" className="pr-tab pp-tab-soon" disabled>
          {icons.layers}{c.tabs.topic}<span className="pp-soon">{c.soon}</span>
        </button>
        <button type="button" className={`pr-tab${tab === "schemes" ? " active" : ""}`} aria-pressed={tab === "schemes"}
          onClick={() => setTab("schemes")}>{icons.checks}{c.tabs.schemes}</button>
      </nav>

      <div className={`pp-grid${tab === "schemes" ? " pp-grid-wide" : ""}`}>
        {tab === "papers" ? (
          <>
            <section className="pr-card pp-years" aria-label={c.selectYear}>
              <h2 className="pr-card-title"><span className="db-plum">{icons.calendar}</span>{c.selectYear}</h2>
              <div className="pp-year-list">
                {years.map((y) => (
                  <button key={y} type="button" className={`pp-year${y === year ? " active" : ""}`}
                    aria-pressed={y === year} onClick={() => setParams({ year: String(y) }, { replace: true })}>
                    {icons.paper}<strong>{y}</strong>{icons.chevronRight}
                  </button>
                ))}
              </div>
            </section>

            <section className="pr-card pp-detail">
              <h2 className="pr-card-title pp-detail-title">
                <span className="db-plum">{icons.paper}</span>{fill(c.yearTitle, { year: year ?? "" })}
              </h2>
              <div className="pp-chips">
                <span>{icons.calendar}{year}</span>
                {inYear[0]?.language && <span>{icons.globe}{medium(inYear[0])}</span>}
                {paperNames(inYear[0]) && <span>{icons.book}{paperNames(inYear[0])}</span>}
                <span>{icons.doc}{pages(inYear[0])}</span>
              </div>

              <div className="pp-cards">
                {inYear.flatMap((doc) => [
                  ...papersIn(doc).map((g, i) => (
                    <article key={`${doc.upload_id}-${g.paper}`} className={`pp-card${i % 2 ? " pp-card-amber" : ""}`}>
                      <span className="pp-card-icon">{icons.paper}</span>
                      <h3>{fill(c.paper, { n: g.paper })}</h3>
                      <p>
                        {g.parts.map((part) => fill(c.part, { n: part })).join(" · ")}
                        {g.parts.length > 0 && <br />}
                        {g.questions > 0 ? fill(c.questions, { n: g.questions }) : fill(c.sections, { n: g.chunks })}
                      </p>
                      <span className="pp-kind">{kind(doc)}</span>
                      <Link className="db-btn-primary pp-read" to={`${doc.upload_id}?paper=${g.paper}`}>
                        {c.read} {icons.arrowRight}
                      </Link>
                    </article>
                  )),
                  <article key={doc.upload_id} className="pp-card pp-card-plain">
                    <span className="pp-card-icon">{icons.checks}</span>
                    <h3>{kind(doc)}</h3>
                    <p>{c.wholeDocument}<br />{pages(doc)}</p>
                    <Link className="db-btn-outline pp-read" to={`${doc.upload_id}`}>{c.read} {icons.arrowRight}</Link>
                  </article>,
                ])}
              </div>

              {!hasQuestionPaper && <p className="pp-note">{fill(c.schemeOnly, { year: year ?? "" })}</p>}
            </section>
          </>
        ) : (
          <section className="pr-card pp-detail">
            <h2 className="pr-card-title"><span className="db-plum">{icons.checks}</span>{c.tabs.schemes}</h2>
            <div className="pp-scheme-list">
              {schemes.map((doc) => (
                <Link key={doc.upload_id} className="pp-scheme" to={`${doc.upload_id}`}>
                  <strong>{doc.exam_year}</strong>
                  <span>{[medium(doc), paperNames(doc), pages(doc)].filter(Boolean).join(" · ")}</span>
                  {icons.chevronRight}
                </Link>
              ))}
            </div>
          </section>
        )}

        <aside className="pp-side">
          <section className="pr-card pp-side-card">
            <h2 className="pr-card-title"><span className="db-plum">{icons.chart}</span>{c.libraryTitle}</h2>
            <dl className="pp-stats">
              <div><dt>{c.statYears}</dt><dd>{years.length}</dd></div>
              <div><dt>{c.statPapers}</dt><dd>{papers.length - schemes.length}</dd></div>
              <div><dt>{c.statSchemes}</dt><dd>{schemes.length}</dd></div>
              <div><dt>{c.statQuestions}</dt><dd>{papers.reduce((n, p) => n + questionCount(p), 0)}</dd></div>
            </dl>
          </section>
          <section className="pr-card pp-side-card">
            <h2 className="pr-card-title"><span className="pr-orange">{icons.sparkle}</span>{c.quickTitle}</h2>
            <div className="pp-actions">
              <button type="button" className="pp-action" onClick={openRandom}>
                {icons.paper}<span>{c.random}</span>{icons.chevronRight}
              </button>
              <Link className="pp-action" to="/dashboard/tutor">
                {icons.chat}<span>{c.askTutor}</span>{icons.chevronRight}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
