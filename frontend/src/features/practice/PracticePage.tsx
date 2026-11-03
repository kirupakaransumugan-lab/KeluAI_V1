import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { MathText } from "../../components/math/MathText";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import { ApiError, tutorApi, type QuizQuestion } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import {
  isDone, loadSaved, loadSet, newSet, saveSaved, saveSet,
  type PracticeSet, type QuestionProgress, type SavedQuestion,
} from "./practiceStore";
import { topicGlyph } from "./topicIcon";
import "../../styles/practice.css";

// Questions come from POST /tutor/quiz: new AI-written questions in the style of real
// Paper I Part A questions, each with a 3-step guided solve. There is no question bank
// or progress table yet, so the set and saved questions are kept in this browser.

type Tab = "all" | "topic" | "daily" | "saved";
type Panel = "none" | "hints" | "steps";

interface TopicRow {
  topic: string;
  indices: number[];
  solved: number;        // guided steps solved across the topic's questions
  total: number;
}

function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <span className="pr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

function Notice({ art, title, text, children }: { art: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="pr-notice">
      <img src={art} alt="" />
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}

export function PracticePage() {
  const { user } = useOutletContext<DashboardContext>();
  const { lang, t } = useLanguage();
  const p = t.dashboard.practice;
  const navigate = useNavigate();

  const [set, setSet] = useState<PracticeSet | null>(() => loadSet(user.id));
  const [saved, setSaved] = useState<SavedQuestion[]>(() => loadSaved(user.id));
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [wrong, setWrong] = useState<number[]>([]);          // options tried and wrong, this step
  const [right, setRight] = useState<number | null>(null);   // option picked and right, this step

  useEffect(() => saveSet(user.id, set), [set, user.id]);
  useEffect(() => saveSaved(user.id, saved), [saved, user.id]);

  const total = set?.questions.length ?? 0;
  const finished = !!set && set.current >= total;
  const q: QuizQuestion | undefined = set && !finished ? set.questions[set.current] : undefined;
  const prog: QuestionProgress | undefined = set && !finished ? set.progress[set.current] : undefined;
  const doneCount = set ? set.questions.filter((x, i) => isDone(x, set.progress[i])).length : 0;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const topics = useMemo<TopicRow[]>(() => {
    if (!set) return [];
    const rows = new Map<string, TopicRow>();
    set.questions.forEach((x, i) => {
      const row = rows.get(x.topic) ?? { topic: x.topic, indices: [], solved: 0, total: 0 };
      const pr = set.progress[i];
      const steps = Math.max(x.steps.length, 1);
      row.indices.push(i);
      row.total += steps;
      row.solved += isDone(x, pr) ? steps : Math.min(pr.solved, steps);
      rows.set(x.topic, row);
    });
    return [...rows.values()];
  }, [set]);

  const resetStep = () => {
    setWrong([]);
    setRight(null);
  };

  const go = (index: number) => {
    if (!set) return;
    setSet({ ...set, current: index });
    setPanel("none");
    resetStep();
  };

  const updateProgress = (fn: (pr: QuestionProgress) => QuestionProgress) =>
    setSet((s) => s && { ...s, progress: s.progress.map((pr, i) => (i === s.current ? fn(pr) : pr)) });

  async function generate() {
    setLoading(true);
    setError(null);
    setTab("all");
    try {
      const r = await tutorApi.quiz(lang);
      setSet(newSet(r.questions, lang));
      setPanel("none");
      resetStep();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const code = err instanceof ApiError ? err.code : "network";
      setError(code === "no_questions_indexed" ? p.errors.notIndexed
        : code === "tutor_not_configured" ? p.errors.notConfigured
        : code === "network" ? p.errors.network : p.errors.failed);
    } finally {
      setLoading(false);
    }
  }

  const isSaved = !!q && saved.some((s) => s.id === q.question);
  const toggleSave = () => {
    if (!q) return;
    setSaved((list) => isSaved ? list.filter((s) => s.id !== q.question)
      : [{ id: q.question, topic: q.topic, question: q.question, answer: q.answer, savedAt: Date.now() }, ...list]);
  };

  const showHint = () => {
    if (!q || !prog) return;
    setPanel("hints");
    if (prog.hints < q.steps.length) updateProgress((pr) => ({ ...pr, hints: pr.hints + 1 }));
  };

  const pick = (i: number) => {
    if (!q || !prog || right !== null || wrong.includes(i)) return;
    if (q.steps[prog.solved].options[i].correct) setRight(i);
    else setWrong((w) => [...w, i]);
  };

  const nextStep = () => {
    updateProgress((pr) => ({ ...pr, solved: pr.solved + 1 }));
    resetStep();
  };

  const askFormula = () => q && navigate(`/dashboard/tutor?q=${encodeURIComponent(fill(p.formulaAsk, { q: q.question }))}`);

  const modelledOn = (x: QuizQuestion) => {
    const m = x.modelled_on;
    return m.exam_year ? fill(p.modelledOn, { src: [m.exam_year, m.question_number && `Q${m.question_number}`].filter(Boolean).join(" ") }) : null;
  };

  // ---------- Sections ----------
  const tabs: { key: Tab | "papers"; label: string; icon: ReactNode }[] = [
    { key: "all", label: p.tabs.all, icon: icons.grid },
    { key: "topic", label: p.tabs.topic, icon: icons.layers },
    { key: "papers", label: p.tabs.papers, icon: icons.paper },
    { key: "daily", label: p.tabs.daily, icon: icons.calendar },
    { key: "saved", label: p.tabs.saved, icon: icons.bookmark },
  ];

  const startOrError = (
    <section className="pr-card pr-wide">
      {loading ? (
        <Notice art="/dashboard/bear-pencil.png" title={p.generating} text={p.generatingText}>
          <span className="pr-dots" aria-hidden="true"><i /><i /><i /></span>
        </Notice>
      ) : (
        <Notice art="/dashboard/bear-cheer.png" title={p.startTitle} text={p.startText}>
          {error && <p className="pr-error" role="alert">{error}</p>}
          <button type="button" className="pr-btn-primary" onClick={generate}>{p.start} {icons.arrowRight}</button>
        </Notice>
      )}
    </section>
  );

  const topicList = (
    <section className="pr-card pr-topics">
      <h2 className="pr-card-title"><span className="db-plum">{icons.book}</span>{p.topics}</h2>
      <div className="pr-topic-list">
        {topics.map((row) => {
          const active = row.indices.includes(set!.current);
          return (
            <button key={row.topic} type="button" className={`pr-topic${active ? " active" : ""}`}
              aria-current={active ? "true" : undefined}
              onClick={() => go(row.indices.find((i) => !isDone(set!.questions[i], set!.progress[i])) ?? row.indices[0])}>
              <span className="pr-glyph" aria-hidden="true">{topicGlyph(row.topic)}</span>
              <span className="pr-topic-copy">
                <strong>{row.topic}</strong>
                <Progress value={row.solved} total={row.total} />
              </span>
              <span className="pr-topic-count">{row.solved} / {row.total}</span>
              {icons.chevronRight}
            </button>
          );
        })}
      </div>
    </section>
  );

  const questionPanel = q && prog && (
    <section className="pr-card pr-question">
      <header className="pr-q-head">
        <div>
          <span className="pr-chip">{q.topic}</span>
          <h2>{p.questionsTitle}</h2>
        </div>
        <div className="pr-q-progress">
          <span>{fill(p.progress, { n: doneCount, total })}</span>
          <div><Progress value={doneCount} total={total} /><b>{pct}%</b></div>
        </div>
      </header>

      <article className="pr-q-card">
        <div className="pr-q-top">
          <span className="pr-q-num">{fill(p.qLabel, { n: set!.current + 1 })}</span>
          <button type="button" className={`pr-save${isSaved ? " on" : ""}`} onClick={toggleSave}
            aria-pressed={isSaved} aria-label={isSaved ? p.unsave : p.save} title={isSaved ? p.unsave : p.save}>
            {isSaved ? icons.bookmarkFilled : icons.bookmark}
          </button>
        </div>
        <MathText className="pr-q-text" text={q.question} />
        <p className="pr-q-meta">{p.aiLabel}{modelledOn(q) && ` · ${modelledOn(q)}`}</p>
      </article>

      <div className="pr-tools">
        <button type="button" className={`pr-tool pr-tool-hint${panel === "hints" ? " on" : ""}`} onClick={showHint}>
          {icons.list}{p.hint}
        </button>
        {q.steps.length > 0 && (
          <button type="button" className={`pr-tool pr-tool-step${panel === "steps" ? " on" : ""}`}
            onClick={() => setPanel(panel === "steps" ? "none" : "steps")}>
            <span className="db-amber">{icons.bulb}</span>{p.stepHint}
          </button>
        )}
        <button type="button" className="pr-tool pr-tool-formula" onClick={askFormula}>
          <span className="pr-orange">{icons.book}</span>{p.formula}
        </button>
      </div>

      {panel === "hints" && (
        <div className="pr-panel">
          <h3>{p.hintsTitle}</h3>
          <ol>
            {q.steps.slice(0, prog.hints).map((s, i) => <li key={i}><MathText text={s.title} /></li>)}
          </ol>
          {prog.hints >= q.steps.length && <p className="pr-muted">{p.noMoreHints}</p>}
        </div>
      )}

      {panel === "steps" && (
        <div className="pr-panel">
          {q.steps.slice(0, prog.solved).map((s, i) => (
            <div key={i} className="pr-step-done">
              <span className="pr-tick">{icons.check}</span>
              <div>
                <strong>{fill(p.stepOf, { n: i + 1, total: q.steps.length })} · <MathText text={s.title} /></strong>
                <MathText text={s.options.find((o) => o.correct)?.text ?? ""} />
              </div>
            </div>
          ))}
          {prog.solved < q.steps.length && (() => {
            const step = q.steps[prog.solved];
            return (
              <div className="pr-step">
                <h3>{fill(p.stepOf, { n: prog.solved + 1, total: q.steps.length })} · <MathText text={step.title} /></h3>
                <p className="pr-muted">{p.pickWorking}</p>
                <div className="pr-options">
                  {step.options.map((o, i) => {
                    const state = right === i ? "right" : wrong.includes(i) ? "wrong" : "";
                    return (
                      <button key={i} type="button" className={`pr-option ${state}`} onClick={() => pick(i)}
                        disabled={right !== null && right !== i} aria-pressed={!!state}>
                        <MathText text={o.text} />
                        {state && <span className="pr-why">{state === "right" ? icons.check : icons.cross}<MathText text={o.why} /></span>}
                      </button>
                    );
                  })}
                </div>
                {right !== null ? (
                  <div className="pr-feedback ok">
                    <span>{p.correct}</span>
                    <button type="button" className="pr-btn-primary pr-btn-sm" onClick={nextStep}>
                      {prog.solved + 1 < q.steps.length ? p.next : p.showAnswer} {icons.arrowRight}
                    </button>
                  </div>
                ) : wrong.length > 0 && <p className="pr-feedback bad">{p.tryAgain}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {isDone(q, prog) ? (
        <div className="pr-answer">
          <strong>{p.answer}</strong>
          <MathText text={q.answer} />
        </div>
      ) : (
        <button type="button" className="pr-link" onClick={() => updateProgress((pr) => ({ ...pr, revealed: true }))}>
          {p.showAnswer}
        </button>
      )}

      <footer className="pr-nav">
        <button type="button" className="pr-btn-outline" onClick={() => go(set!.current - 1)} disabled={set!.current === 0}>
          {icons.arrowLeft}{p.previous}
        </button>
        <span>{fill(p.of, { n: set!.current + 1, total })}</span>
        <button type="button" className="pr-btn-primary" onClick={() => go(set!.current + 1)}>
          {set!.current + 1 < total ? p.continue : p.finish} {icons.arrowRight}
        </button>
      </footer>
    </section>
  );

  const finishedPanel = (
    <section className="pr-card pr-question">
      <Notice art="/dashboard/bear-cheer.png" title={p.doneTitle} text={fill(p.doneText, { n: doneCount, total })}>
        <div className="pr-row">
          <button type="button" className="pr-btn-outline" onClick={() => go(0)}>{icons.arrowLeft}{p.previous}</button>
          <button type="button" className="pr-btn-primary" onClick={generate} disabled={loading}>{p.newSet} {icons.arrowRight}</button>
        </div>
      </Notice>
    </section>
  );

  let body: ReactNode;
  if (tab === "saved") {
    body = saved.length === 0 ? (
      <section className="pr-card pr-wide">
        <Notice art="/dashboard/bear-cheer.png" title={p.savedEmpty} text={p.savedEmptyText} />
      </section>
    ) : (
      <div className="pr-saved">
        {saved.map((s) => (
          <article key={s.id} className="pr-card pr-saved-card">
            <div className="pr-q-top">
              <span className="pr-chip"><span aria-hidden="true">{topicGlyph(s.topic)}</span> {s.topic}</span>
              <button type="button" className="pr-link" onClick={() => setSaved((l) => l.filter((x) => x.id !== s.id))}>
                {p.remove}
              </button>
            </div>
            <MathText className="pr-q-text" text={s.question} />
            <details>
              <summary>{p.showAnswer}</summary>
              <MathText text={s.answer} />
            </details>
          </article>
        ))}
      </div>
    );
  } else if (tab === "daily") {
    body = (
      <section className="pr-card pr-wide">
        <Notice art="/dashboard/bear-cheer.png" title={p.dailyTitle} text={p.dailyText}>
          {set && !loading && <p className="pr-muted">{p.dailyWarn}</p>}
          {error && <p className="pr-error" role="alert">{error}</p>}
          <button type="button" className="pr-btn-primary" onClick={generate} disabled={loading}>
            {loading ? p.generating : p.start} {icons.arrowRight}
          </button>
        </Notice>
      </section>
    );
  } else if (!set || loading) {
    body = startOrError;
  } else if (tab === "topic") {
    body = (
      <div className="pr-topic-grid">
        {topics.map((row) => (
          <section key={row.topic} className="pr-card pr-topic-card">
            <span className="pr-glyph pr-glyph-lg" aria-hidden="true">{topicGlyph(row.topic)}</span>
            <h3>{row.topic}</h3>
            <Progress value={row.solved} total={row.total} />
            <span className="pr-muted">{fill(p.steps, { n: row.solved, total: row.total })}</span>
            <button type="button" className="pr-btn-outline" onClick={() => { go(row.indices[0]); setTab("all"); }}>
              {p.practiceTopic} {icons.arrowRight}
            </button>
          </section>
        ))}
      </div>
    );
  } else {
    body = <div className="pr-grid">{topicList}{finished ? finishedPanel : questionPanel}</div>;
  }

  return (
    <main className="db-content pr-page">
      <header className="pr-hero">
        <span className="pr-target" aria-hidden="true">{icons.target}</span>
        <div className="pr-hero-copy">
          <h1>{p.title}</h1>
          <p>{p.subtitle}</p>
        </div>
        <img className="pr-hero-art" src="/dashboard/bear-pencil.png" alt="" />
      </header>

      <nav className="pr-tabs" aria-label={p.title}>
        {tabs.map((x) => x.key === "papers" ? (
          <Link key={x.key} to="/dashboard/past-papers" className="pr-tab">{x.icon}{x.label}</Link>
        ) : (
          <button key={x.key} type="button" className={`pr-tab${tab === x.key ? " active" : ""}`}
            aria-pressed={tab === x.key} onClick={() => setTab(x.key as Tab)}>
            {x.icon}{x.label}
          </button>
        ))}
      </nav>

      {body}
    </main>
  );
}
