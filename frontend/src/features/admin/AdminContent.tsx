import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { icons } from "../dashboard/icons";
import { loadError } from "./loadError";
import { adminApi, type ContentOverview, type ContentTopic } from "../../services/api";
import "../../styles/admin-students.css";
import "../../styles/admin-library.css";

// Admin > Content: syllabus coverage. For each topic, the past-paper examples the AI can model
// questions on, the stored quiz questions per medium, and how students score on it in practice.
// Gaps link to the page that fixes them (Knowledge Base, Quiz Bank).

type Strand = "all" | "pure" | "applied";
type Sort = "syllabus" | "gaps" | "weakest" | "most_practised";
const SORTS: { key: Sort; label: string }[] = [
  { key: "syllabus", label: "Syllabus order" }, { key: "gaps", label: "Gaps first" },
  { key: "weakest", label: "Weakest score" }, { key: "most_practised", label: "Most practised" },
];
const num = (n: number) => n.toLocaleString("en-LK");

function sortTopics(rows: ContentTopic[], sort: Sort): ContentTopic[] {
  const out = [...rows];
  if (sort === "gaps") out.sort((a, b) => b.flags.length - a.flags.length || a.kb_chunks - b.kb_chunks);
  if (sort === "weakest") out.sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  if (sort === "most_practised") out.sort((a, b) => b.practice_answers - a.practice_answers);
  return out;
}

function Score({ value }: { value: number | null }) {
  if (value == null) return <span className="ad-muted">—</span>;
  const tone = value >= 70 ? "good" : value >= 45 ? "mid" : "low";
  return (
    <span className={`ad-ct-score ${tone}`}>
      <span className="ad-ct-bar" aria-hidden="true"><i style={{ width: `${value}%` }} /></span>{value}%
    </span>
  );
}

export function AdminContent() {
  const [data, setData] = useState<ContentOverview>();
  const [failed, setFailed] = useState<string | null>(null);
  const [strand, setStrand] = useState<Strand>("all");
  const [sort, setSort] = useState<Sort>("syllabus");
  const load = useCallback(() => {
    adminApi.content().then((d) => { setData(d); setFailed(null); },
      (err) => setFailed(loadError(err, "Couldn't load the syllabus coverage.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => sortTopics((data?.topics ?? []).filter((t) => strand === "all" || t.strand === strand), sort),
    [data, strand, sort]);

  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Content</h1>
          <p>Syllabus coverage: examples the AI can use, stored quiz questions and student scores per topic.</p>
        </div>
      </div>
      {failed ? (
        <section className="ad-card" role="alert">
          <p className="ad-pad ad-muted">{failed}</p>
          <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
        </section>
      ) : !data ? (
        <section className="ad-card" role="status"><p className="ad-pad ad-muted">Loading…</p></section>
      ) : (
        <>
          <div className="ad-ct-summary">
            <article className="ad-card ad-ct-stat"><strong>{data.totals.topics}</strong><span>Syllabus topics</span></article>
            <Link to="/admin/knowledge-base" className="ad-card ad-ct-stat warn">
              <strong>{data.totals.few_examples}</strong><span>Topics with fewer than {data.few_examples} past-paper examples</span>
            </Link>
            <Link to="/admin/quiz-bank" className="ad-card ad-ct-stat warn">
              <strong>{data.totals.bank_gaps}</strong><span>Topics missing quiz questions in English or Tamil</span>
            </Link>
            <article className="ad-card ad-ct-stat">
              <strong>{num(data.totals.practice_answers)}</strong>
              <span>Practice answers{data.totals.unmatched_answers ? ` (+${num(data.totals.unmatched_answers)} not matched to a topic)` : ""}</span>
            </article>
          </div>

          <section className="ad-card">
            <div className="ad-kb-docs-head">
              <div className="ad-kb-tabs" role="tablist" aria-label="Strand">
                {(["all", "pure", "applied"] as Strand[]).map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={strand === s} className={strand === s ? "active" : ""}
                    onClick={() => setStrand(s)}>{{ all: "All topics", pure: "Pure (Paper I)", applied: "Applied (Paper II)" }[s]}</button>
                ))}
              </div>
              <label className="ad-ct-sort">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table ad-ct-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th className="ad-num" title="Past-paper chunks tagged with this topic">Examples</th>
                    <th className="ad-num">Quiz EN</th><th className="ad-num">Quiz TA</th>
                    <th className="ad-num">Answers</th><th className="ad-num">Students</th><th>Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.key}>
                      <td>
                        <strong>{t.name_en}</strong>
                        <small lang="ta" className="ad-ct-ta">{t.name_ta}</small>
                        <span className={`ad-pill ad-ct-strand ${t.strand}`}>{t.strand === "pure" ? "Pure" : "Applied"}</span>
                      </td>
                      <td className={`ad-num${t.flags.includes("few_examples") ? " ad-ct-gap" : ""}`}>{t.kb_chunks}</td>
                      <td className={`ad-num${t.bank.en ? "" : " ad-ct-gap"}`}>{t.bank.en}</td>
                      <td className={`ad-num${t.bank.ta ? "" : " ad-ct-gap"}`}>{t.bank.ta}</td>
                      <td className="ad-num">{num(t.practice_answers)}</td>
                      <td className="ad-num">{num(t.students)}</td>
                      <td><Score value={t.score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ad-muted ad-ct-note">
              {icons.bulb} Red numbers are gaps. Examples come from the topic tags: after adding past papers, use
              “Update topic tags” on the Knowledge Base page. Quiz questions are added on the Quiz Bank page.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
