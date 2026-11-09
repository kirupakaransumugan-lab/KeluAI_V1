import { useCallback, useEffect, useState } from "react";
import { MathText } from "../../components/math/MathText";
import { icons } from "../dashboard/icons";
import { ApiError, adminApi, type QuizBankDraft, type QuizBankOverview } from "../../services/api";

// Questions for the 10-question whole-syllabus quiz, the only stored questions. The AI writes a
// set of drafts here; a person publishes each one before exam-year students see it, because the
// AI's working and answers can be wrong. English first, then Tamil.

const POLL_MS = 5000;

const BLOCKED: Record<string, string> = {
  job_running: "A set is being written.",
  daily_set_done: "Today's set is done. You can write the next one tomorrow.",
};
const JOB_ENDED: Record<string, string> = {
  stopped: "This set stopped early because questions kept failing. The AI quota may be used up.",
  failed: "This set couldn't finish. The server may have restarted, or the AI isn't set up. Any drafts written are below.",
};

function Draft({ draft, busy, onPublish, onReject }: {
  draft: QuizBankDraft; busy: boolean; onPublish: () => void; onReject: () => void;
}) {
  return (
    <article className="ad-draft">
      <header className="ad-draft-head">
        <span className="ad-draft-topic">{draft.topic}</span>
        {draft.strand && <span className="ad-muted">{draft.strand === "pure" ? "Pure" : "Applied"}</span>}
        {draft.modelled_on.exam_year && <span className="ad-muted">In the style of {draft.modelled_on.exam_year}</span>}
      </header>
      <MathText className="ad-draft-question" text={draft.question} />
      <ol className="ad-draft-steps">
        {draft.steps.map((step, i) => {
          const right = step.options.find((o) => o.correct);
          return (
            <li key={i}>
              <strong><MathText text={step.title} /></strong>
              {right && <MathText text={right.text} />}
              <details>
                <summary>Wrong options and explanations</summary>
                <ul>
                  {step.options.map((o, j) => (
                    <li key={j}>
                      <span className={o.correct ? "ad-up" : "ad-muted"}>{o.correct ? "Right" : "Wrong"}</span>
                      <MathText text={o.text} />
                      {o.why && <MathText className="ad-draft-why" text={o.why} />}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
      <div className="ad-draft-answer"><strong>Answer</strong><MathText text={draft.answer} /></div>
      <footer className="ad-draft-foot">
        <button type="button" className="db-btn-outline" onClick={onReject} disabled={busy}>Reject</button>
        <button type="button" className="db-btn-primary ad-draft-publish" onClick={onPublish} disabled={busy}>
          {icons.check} Publish
        </button>
      </footer>
    </article>
  );
}

export function AdminQuizBank() {
  const [data, setData] = useState<QuizBankOverview>();
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "generate" | null>(null);

  const load = useCallback(() => adminApi.quizBank("en").then((d) => { setData(d); setFailed(false); }, () => setFailed(true)), []);

  useEffect(() => { void load(); }, [load]);

  const running = data?.job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  const generate = async () => {
    setBusy("generate");
    setNotice(null);
    try {
      await adminApi.generateQuizSet("en");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setNotice((code && BLOCKED[code]) ?? "Couldn't start the set. Please try again.");
    }
    await load();
    setBusy(null);
  };

  const review = async (id: number, action: (id: number) => Promise<unknown>) => {
    setBusy(id);
    setNotice(null);
    try {
      await action(id);
    } catch {
      setNotice("That didn't save. Please try again.");
    }
    await load();
    setBusy(null);
  };

  if (!data) {
    return (
      <main className="db-content ad-page">
        <div className="ad-head"><div><h1>Quiz Bank</h1></div></div>
        <section className="ad-card" role={failed ? "alert" : "status"}>
          <p className="ad-pad ad-muted">{failed ? "Couldn't load the quiz bank." : "Loading…"}</p>
          {failed && <button type="button" className="db-btn-outline" onClick={() => void load()}>Try again</button>}
        </section>
      </main>
    );
  }

  const { job, topics, drafts, blocked } = data;
  const published = topics.reduce((n, t) => n + t.published, 0);
  const empty = topics.filter((t) => !t.published).length;
  const count = (strand: string) => topics.filter((t) => t.strand === strand).reduce((n, t) => n + t.published, 0);
  const pure = count("pure"), applied = count("applied");
  const handled = job ? job.added + job.failed : 0;

  const strand = (key: "pure" | "applied", title: string) => (
    <div>
      <h3 className="ad-bank-strand">{title}</h3>
      <table className="ad-bank-table">
        <thead>
          <tr><th scope="col">Topic</th><th scope="col">Published</th><th scope="col">Drafts</th></tr>
        </thead>
        <tbody>
          {topics.filter((t) => t.strand === key).map((t) => (
            <tr key={t.key}><td>{t.name}</td><td>{t.published}</td><td>{t.drafts || "–"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Quiz Bank</h1>
          <p>Questions for the 10-question whole-syllabus quiz, for exam-year students. Publish the ones that are right.</p>
        </div>
      </div>

      <div className="ad-body">
        <div className="ad-bank-stats">
          <article className="ad-card"><strong>{published}</strong><span>Published to students</span></article>
          <article className="ad-card"><strong>{drafts.length}</strong><span>Waiting for review</span></article>
          <article className="ad-card"><strong>{Math.min(pure, 5) + Math.min(applied, 5)} / 10</strong><span>Questions in a student's quiz ({pure} Pure, {applied} Applied published)</span></article>
          <article className="ad-card"><strong>{empty} / {topics.length}</strong><span>Topics with no questions</span></article>
        </div>

        <section className="ad-card ad-bank-generate">
          <div className="ad-bank-copy">
            <h2>Today's set</h2>
            <p className="ad-muted">
              Writes up to 10 English draft questions, 5 Pure and 5 Applied, on the emptiest topics. It takes several
              minutes, and you can leave this page while it runs. Please don't restart the server until it finishes.
            </p>
            {running && job && (
              <div className="ad-bank-progress" role="status">
                <span>Writing questions: {handled} of {job.requested} done{job.failed ? ` (${job.failed} unusable)` : ""}</span>
                <progress max={job.requested} value={handled} />
              </div>
            )}
            {!running && job && JOB_ENDED[job.status] && <p className="ad-bank-warn" role="alert">{JOB_ENDED[job.status]}</p>}
            {!running && blocked && <p className="ad-muted">{BLOCKED[blocked]}</p>}
            {notice && <p className="ad-bank-warn" role="alert">{notice}</p>}
          </div>
          <button type="button" className="db-btn-primary ad-bank-go" onClick={generate} disabled={!!blocked || busy === "generate"}>
            {icons.sparkle} Generate set
          </button>
        </section>

        <section className="ad-card">
          <div className="ad-bank-copy">
            <h2>Review drafts</h2>
            <p className="ad-muted">
              Work out each answer yourself before publishing: the AI can be wrong. Students only see what you publish.
              Rejecting a draft deletes it.
            </p>
          </div>
          {drafts.length ? (
            <div className="ad-draft-list">
              {drafts.map((d) => (
                <Draft key={d.id} draft={d} busy={busy !== null}
                  onPublish={() => void review(d.id, adminApi.publishDraft)}
                  onReject={() => void review(d.id, adminApi.rejectDraft)} />
              ))}
            </div>
          ) : <p className="ad-pad ad-muted">No drafts waiting.</p>}
        </section>

        <section className="ad-card">
          <div className="ad-bank-copy"><h2>Questions by topic</h2></div>
          <div className="ad-bank-strands">
            {strand("pure", "Pure mathematics")}
            {strand("applied", "Applied mathematics")}
          </div>
        </section>
      </div>
    </main>
  );
}
