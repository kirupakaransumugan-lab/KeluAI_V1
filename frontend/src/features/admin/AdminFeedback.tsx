import { useCallback, useEffect, useState } from "react";
import { MathText } from "../../components/math/MathText";
import { adminApi, type FeedbackReport } from "../../services/api";

// Student reports on practice questions. Questions aren't stored, so a report can't change one:
// it shows what students are finding, and the AI can give a second opinion on the maths.
// Student details are left out on purpose.

const VERDICT: Record<string, string> = {
  CONFIRMED: "AI agrees with the student",
  NOT_CONFIRMED: "AI disagrees with the student",
  UNSURE: "AI isn't sure",
};

function Report({ report, onChanged }: { report: FeedbackReport; onChanged: () => void }) {
  const q = report.question;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (name: string, action: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await action();
      onChanged();
    } catch {
      setError(name === "review" ? "The AI review failed. The quota may be used up: try again later." : "That didn't save. Please try again.");
    }
    setBusy(null);
  };

  return (
    <article className="ad-draft">
      <header className="ad-draft-head">
        <span className="ad-draft-topic">{q?.topic}</span>
        <span className="ad-muted">{report.kind === "method" ? "Another method" : "Reported mistake"}</span>
      </header>

      <h3 className="ad-fb-h">Question the student saw</h3>
      <MathText className="ad-draft-question" text={q?.question ?? ""} />
      <div className="ad-draft-answer"><strong>Answer given</strong><MathText text={q?.answer ?? ""} /></div>

      <h3 className="ad-fb-h">Student says</h3>
      <MathText className="ad-fb-message" text={report.message} />
      {report.has_image && (
        <a href={adminApi.feedbackImageUrl(report.id)} target="_blank" rel="noreferrer">
          <img className="ad-fb-image" src={adminApi.feedbackImageUrl(report.id)} alt="The student's written working" />
        </a>
      )}

      {report.ai && (
        <div className={`ad-fb-ai ${report.ai.verdict.toLowerCase()}`}>
          <strong>{VERDICT[report.ai.verdict]}</strong>
          <MathText text={report.ai.reason} />
        </div>
      )}

      {error && <p className="ad-bank-warn" role="alert">{error}</p>}
      <footer className="ad-draft-foot">
        <button type="button" className="db-btn-outline" disabled={!!busy}
          onClick={() => act("review", () => adminApi.reviewFeedback(report.id))}>
          {busy === "review" ? "AI is checking…" : report.ai ? "Ask AI again" : "Ask AI to review"}
        </button>
        <button type="button" className="db-btn-primary ad-draft-publish" disabled={!!busy}
          onClick={() => act("close", () => adminApi.closeFeedback(report.id))}>Close report</button>
      </footer>
    </article>
  );
}

export function AdminFeedback() {
  const [reports, setReports] = useState<FeedbackReport[]>();
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    adminApi.feedback().then((r) => { setReports(r.reports); setFailed(false); }, () => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Student Feedback</h1>
          <p>Mistakes and other methods students found in their practice questions.</p>
        </div>
      </div>
      {failed ? (
        <section className="ad-card" role="alert">
          <p className="ad-pad ad-muted">Couldn't load the feedback.</p>
          <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
        </section>
      ) : !reports ? (
        <section className="ad-card" role="status"><p className="ad-pad ad-muted">Loading…</p></section>
      ) : reports.length ? (
        <div className="ad-draft-list">
          {reports.map((r) => <Report key={r.id} report={r} onChanged={load} />)}
        </div>
      ) : (
        <section className="ad-card"><p className="ad-pad ad-muted">No feedback waiting.</p></section>
      )}
    </main>
  );
}
