import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { MathText } from "../../components/math/MathText";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import {
  ApiError, progressApi, quizzesApi, savedApi, tutorApi,
  type FullQuizInfo, type PracticeSubject, type QuizQuestion, type SavedQuestion,
} from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import {
  FULL_KEY, addQuestion, answeredSteps, attemptAnswers, clearLocalSaved, emptySet, failSlot, fullSet, isDone,
  loadLocalSaved, loadSeen, loadSets, markSeen, quizState, saveSets, score, stepRight,
  type PracticeSet, type PracticeSets, type QuestionProgress, type QuizState,
} from "./practiceStore";
import { FeedbackForm } from "./FeedbackForm";
import { SubjectPicker } from "./SubjectPicker";
import { topicGlyph } from "./topicIcon";
import "../../styles/practice.css";

// Clicking a topic starts its quiz: the AI writes 5 new questions on it, one request each (POST
// /tutor/quiz/question), climbing from easiest to hardest, each with a 3-step guided solve and the
// answer and reasons shown right after it. Writing happens in the background, so the topic list
// stays in view: a student can start one topic, keep browsing, start another, and open whichever
// is ready. Questions are never stored on the server: a finished quiz saves only the marks.
// Exam-year students can also take the whole-syllabus quiz: up to 10 admin-approved questions
// from the quiz bank, so it starts at once and needs no AI.

type Tab = "all" | "saved";

const CONCURRENCY = 3;    // AI requests at once, across every quiz: free models queue extra ones
const MAX_WRITING = 3;    // quizzes being written at once: each costs 5 AI requests

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

/** Apply `fn` to the quiz whose id is `id`, wherever it is: a result that arrives after its quiz
 *  was replaced finds nothing, so it can't land in a newer quiz. */
const mapSet = (all: PracticeSets, id: number, fn: (s: PracticeSet) => PracticeSet): PracticeSets =>
  Object.fromEntries(Object.entries(all).map(([key, s]) => [key, s.createdAt === id ? fn(s) : s]));

export function PracticePage() {
  const { user } = useOutletContext<DashboardContext>();
  const { lang, t } = useLanguage();
  const p = t.dashboard.practice;
  const navigate = useNavigate();

  const [sets, setSets] = useState<PracticeSets>(() => loadSets(user.id));
  const [openKey, setOpenKey] = useState<string | null>(null);     // the quiz in the overlay
  const [subjects, setSubjects] = useState<PracticeSubject[]>();
  const [fullQuiz, setFullQuiz] = useState<FullQuizInfo>();
  const [starting, setStarting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<SavedQuestion[]>([]);
  const [savedStatus, setSavedStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [savedNote, setSavedNote] = useState<string | null>(null);     // a save/remove that failed
  const [savedQuery, setSavedQuery] = useState("");
  const [savedTopic, setSavedTopic] = useState("");
  // The tab lives in the URL (?tab=saved), so the sidebar's "Saved Questions" can link straight
  // to it and highlight itself, and reload/back keep the tab.
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "saved" ? "saved" : "all";
  const setTab = (next: Tab) => setParams((prev) => {
    if (next === "saved") prev.set("tab", "saved");
    else prev.delete("tab");
    return prev;
  }, { replace: true });
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(() => {
    quizzesApi.subjects(lang).then((r) => { setSubjects(r.subjects); setFullQuiz(r.full_quiz); }, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setError(p.errors.network);
    });
  }, [lang, navigate, p.errors.network]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  useEffect(() => saveSets(user.id, sets), [sets, user.id]);

  // Saved questions come from the server. A list an older version kept in this browser is
  // uploaded first (repeats are skipped server-side), then cleared here.
  const loadSavedList = useCallback(async () => {
    setSavedStatus("loading");
    try {
      const local = loadLocalSaved(user.id);
      if (local.length) {
        await savedApi.importLocal(local.slice(0, 200).map(({ topic, question, answer }) => ({ topic, question, answer })));
        clearLocalSaved(user.id);
      }
      setSaved((await savedApi.list()).questions);
      setSavedStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setSavedStatus("failed");
    }
  }, [user.id, navigate]);
  useEffect(() => { loadSavedList(); }, [loadSavedList]);

  // Each finished quiz goes to the server for the progress report. `recorded` is stored with it,
  // so a save that failed is tried again on the next visit; the server ignores repeats.
  const saving = useRef(new Set<number>());
  useEffect(() => {
    for (const s of Object.values(sets)) {
      if (s.submittedAt === null || s.recorded || saving.current.has(s.createdAt)) continue;
      const id = s.createdAt;
      const done = () => {
        setSets((all) => mapSet(all, id, (x) => ({ ...x, recorded: true })));
        saving.current.delete(id);
        loadSubjects();                      // this quiz's marks are in: show the new score
      };
      const answers = attemptAnswers(s);
      if (!answers.length) {
        done();
        continue;
      }
      saving.current.add(id);
      progressApi.saveAttempt(id, s.lang, answers).then(done, () => { saving.current.delete(id); });
    }
  }, [sets, loadSubjects]);

  const errorText = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "network";
    return code === "no_questions_indexed" ? p.errors.notIndexed
      : code === "tutor_not_configured" ? p.errors.notConfigured
      : code === "no_bank_questions" ? p.errors.noFullQuiz
      : code === "full_quiz_locked" ? p.errors.fullLocked
      : code === "network" ? p.errors.network : p.errors.failed;
  };

  // ---------- Question queue ----------
  // The AI writes one question per request, CONCURRENCY at a time across every quiz, oldest quiz
  // first. A question is never asked for twice while the page is open: a request can end before
  // React applies its result, and each repeat is a real AI call.
  const inFlight = useRef(new Set<string>());
  const requested = useRef(new Set<string>());
  const [, bump] = useState(0);                              // re-run the queue when a request ends

  useEffect(() => {
    const jobs = Object.values(sets).sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((s) => s.todo.map((slot) => ({ s, slot, key: `${s.createdAt}:${slot}` })))
      .filter((j) => !requested.current.has(j.key));
    for (const { s, slot, key } of jobs.slice(0, Math.max(0, CONCURRENCY - inFlight.current.size))) {
      const id = s.createdAt;
      inFlight.current.add(key);
      requested.current.add(key);
      tutorApi.quizQuestion(s.lang, slot, s.topic)
        .then((r) => setSets((all) => mapSet(all, id, (x) => addQuestion(x, slot, r.question))))
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            navigate("/login", { replace: true });
            return;
          }
          // Nothing indexed or AI not set up: every other question would fail the same way.
          const fatal = err instanceof ApiError && (err.code === "no_questions_indexed" || err.code === "tutor_not_configured");
          setSets((all) => mapSet(all, id, (x) => failSlot(x, fatal ? "all" : slot)));
          setError(errorText(err));
        })
        .finally(() => {
          inFlight.current.delete(key);
          bump((n) => n + 1);
        });
    }
  });   // every render: cheap, and only starts requests for questions not already asked for

  const states: Record<string, QuizState | null> = Object.fromEntries(
    Object.entries(sets).map(([key, s]) => [key, quizState(s)]));
  const nameOf = (key: string) => (key === FULL_KEY ? p.fullTitle
    : subjects?.find((s) => s.key === key)?.name[lang] ?? key);

  /** A new quiz on this topic, written in the background. Nothing opens: the topic's tile shows
   *  when it is ready, and the student keeps browsing meanwhile. */
  const startTopic = (key: string) => {
    const writing = Object.entries(sets).filter(([k, s]) => k !== key && s.todo.length > 0).length;
    if (writing >= MAX_WRITING) {
      setError(fill(p.errors.tooMany, { n: MAX_WRITING }));
      return;
    }
    setError(null);
    setSets((all) => ({ ...all, [key]: emptySet(lang, key) }));
  };

  /** A topic was clicked: open its quiz if one is under way, otherwise start a new one. */
  const pickTopic = (key: string) => {
    const state = states[key];
    if (state && state.state !== "done") setOpenKey(key);
    else startTopic(key);
  };

  // The dashboard's study plan and "Needs work" link here with ?topic=<key>: act on it once the
  // subjects are known, then drop it so a reload doesn't start another quiz.
  const linkedTopic = params.get("topic");
  useEffect(() => {
    if (!linkedTopic || !subjects) return;
    if (subjects.some((s) => s.key === linkedTopic)) pickTopic(linkedTopic);
    setParams((prev) => { prev.delete("topic"); return prev; }, { replace: true });
  }, [linkedTopic, subjects]);   // eslint-disable-line react-hooks/exhaustive-deps -- once per link

  // The home page's "Start quiz" links here with ?start=full once it knows the student may take
  // the 10-question quiz. The server still refuses anyone else (full_quiz_locked).
  const startParam = params.get("start");
  useEffect(() => {
    if (startParam !== "full" || !fullQuiz) return;
    if (fullQuiz.allowed) void startFull();
    setParams((prev) => { prev.delete("start"); return prev; }, { replace: true });
  }, [startParam, fullQuiz]);   // eslint-disable-line react-hooks/exhaustive-deps -- once per link

  /** The whole-syllabus quiz: stored questions, avoiding ones this student has seen. */
  const startFull = async () => {
    const state = states[FULL_KEY];
    if (state && state.state !== "done") {
      setOpenKey(FULL_KEY);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const { questions } = await tutorApi.fullQuiz(lang, loadSeen(user.id));
      markSeen(user.id, questions.map((q) => q.bank_id));
      setSets((all) => ({ ...all, [FULL_KEY]: fullSet(lang, questions) }));
      setTab("all");
      setOpenKey(FULL_KEY);
    } catch (err) {
      setError(errorText(err));
    }
    setStarting(false);
  };

  // ---------- The open quiz ----------
  const set: PracticeSet | undefined = openKey ? sets[openKey] : undefined;
  const quizOpen = !!set;
  /** Change the open quiz. Its id is taken now, so a quiz replaced meanwhile is left alone. */
  const updateOpen = (fn: (s: PracticeSet) => PracticeSet) => {
    if (set) setSets((all) => mapSet(all, set.createdAt, fn));
  };

  const questions = set?.questions ?? [];
  const progress = set?.progress ?? [];
  const current = set?.current ?? 0;
  const written = questions.length;
  const total = written + (set?.held.length ?? 0) + (set?.todo.length ?? 0);
  const writing = (set?.todo.length ?? 0) > 0;
  const submitted = !!set && set.submittedAt !== null;
  const waiting = current >= written && writing;              // student is ahead of the AI
  const q: QuizQuestion | undefined = questions[current];
  const prog: QuestionProgress | undefined = progress[current];
  const doneCount = questions.filter((x, i) => isDone(x, progress[i])).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const unanswered = progress.reduce((n, pr, i) => n + questions[i].steps.length - answeredSteps(pr), 0);
  const result = set ? score(set) : { steps: 0, right: 0, perfect: 0, questions: 0, pct: 0 };
  const onLast = current + 1 >= total;

  const close = () => setOpenKey(null);
  const go = (index: number) => {
    updateOpen((s) => ({ ...s, current: Math.max(0, index) }));
    modalRef.current?.querySelector(".pr-modal-body")?.scrollTo({ top: 0 });
  };

  /** "New quiz" after finishing: the same topic again, written while the overlay stays open. */
  const startAgain = () => {
    if (!set) return;
    if (set.full) void startFull();
    else startTopic(set.topic);
  };

  // While the overlay is open: Esc closes it, focus moves into it (screen readers and the
  // keyboard start inside the quiz), and the page behind does not scroll.
  useEffect(() => {
    if (!quizOpen) return;
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenKey(null); };
    const root = document.documentElement, before = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = before;
    };
  }, [quizOpen]);

  const updateProgress = (fn: (pr: QuestionProgress) => QuestionProgress) =>
    updateOpen((s) => ({ ...s, progress: s.progress.map((pr, i) => (i === s.current ? fn(pr) : pr)) }));

  // Saving is offered on the results only: a saved question shows its answer in the Saved tab.
  // Both directions are optimistic: the bookmark flips at once and flips back if the server says no.
  const busySave = useRef(new Set<string>());
  const isSaved = (x: QuizQuestion) => saved.some((s) => s.question === x.question);
  const failSave = (err: unknown) => setSavedNote(
    err instanceof ApiError && err.code === "saved_limit" ? p.savedList.limit : p.savedList.saveFailed);

  const removeSaved = (row: SavedQuestion) => {
    setSavedNote(null);
    setSaved((list) => list.filter((s) => s.id !== row.id));
    if (row.id < 0) return;                                   // still being saved: nothing on the server yet
    savedApi.remove(row.id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return;     // already gone
      setSaved((list) => [row, ...list]);
      failSave(err);
    });
  };

  const toggleSave = (x: QuizQuestion) => {
    const existing = saved.find((s) => s.question === x.question);
    if (existing) return removeSaved(existing);
    if (busySave.current.has(x.question)) return;
    busySave.current.add(x.question);
    setSavedNote(null);
    const temp: SavedQuestion = { id: -Date.now(), topic: x.topic, question: x.question, answer: x.answer,
      saved_at: new Date().toISOString() };
    setSaved((list) => [temp, ...list]);
    savedApi.save({ topic: x.topic, question: x.question, answer: x.answer })
      .then((row) => setSaved((list) => [row, ...list.filter((s) => s.id !== temp.id && s.id !== row.id)]))
      .catch((err) => { setSaved((list) => list.filter((s) => s.id !== temp.id)); failSave(err); })
      .finally(() => busySave.current.delete(x.question));
  };

  /** Pick option `option` for step `step` of the current question. */
  const choose = (step: number, option: number) => {
    if (submitted || prog?.checked) return;
    updateProgress((pr) => ({ picks: pr.picks.map((x, i) => (i === step ? option : x)) }));
  };

  /** A subject quiz: lock this question and show its answer and reasons. */
  const checkAnswer = () => {
    updateProgress((pr) => ({ ...pr, checked: true }));
    modalRef.current?.querySelector(".pr-modal-body")?.scrollTo({ top: 0 });
  };

  const finishQuiz = () => {
    updateOpen((s) => ({ ...s, submittedAt: Date.now(), current: 0 }));
    modalRef.current?.querySelector(".pr-modal-body")?.scrollTo({ top: 0 });
  };

  const modelledOn = (x: QuizQuestion) => {
    const m = x.modelled_on;
    return m.exam_year ? fill(p.modelledOn, { src: [m.exam_year, m.question_number && `Q${m.question_number}`].filter(Boolean).join(" ") }) : null;
  };

  // ---------- Sections ----------
  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "all", label: p.tabs.all, icon: icons.grid },
    { key: "saved", label: p.tabs.saved, icon: icons.bookmark },
  ];

  const statusText = (s: QuizState) => (
    s.state === "writing" ? fill(p.running.writing, { n: s.ready, total: s.total })
      : s.state === "ready" ? p.running.ready
      : s.state === "answering" ? fill(p.running.answering, { n: s.answered, total: s.total })
      : fill(p.running.done, { pct: s.pct }));

  // Every quiz not finished yet, newest first, so the student can come back to any of them.
  const running = Object.entries(sets)
    .flatMap(([key, s]) => {
      const state = states[key];
      return state && state.state !== "done" ? [{ key, state, created: s.createdAt }] : [];
    })
    .sort((a, b) => b.created - a.created);

  const runningStrip = running.length > 0 && (
    <section className="pr-running" aria-label={p.running.title}>
      <h2 className="pr-choose-title">{p.running.title}</h2>
      <div className="pr-running-list">
        {running.map(({ key, state }) => (
          <article key={key} className={`pr-card pr-run ${state.state}`}>
            <span className="pr-glyph" aria-hidden="true">{key === FULL_KEY ? "Σ" : topicGlyph(nameOf(key))}</span>
            <div className="pr-run-copy">
              <strong>{nameOf(key)}</strong>
              <span>{statusText(state)}</span>
              <Progress value={state.state === "writing" ? state.ready : state.answered} total={state.total} />
            </div>
            <button type="button" className={state.state === "writing" ? "pr-btn-outline pr-btn-sm" : "pr-btn-primary pr-btn-sm"}
              onClick={() => setOpenKey(key)}>
              {state.state === "answering" ? p.running.continueQuiz : p.running.open}
            </button>
          </article>
        ))}
      </div>
    </section>
  );

  const picker = <SubjectPicker subjects={subjects} fullQuiz={fullQuiz} fullState={states[FULL_KEY] ?? null}
    states={states} statusText={statusText} starting={starting} error={error} onPick={pickTopic}
    onNewQuiz={startTopic} onStartFull={startFull} />;

  // ---------- The quiz ----------
  // Every step of the question with its four options. A subject quiz shows the answer and
  // reasons after "Check answer"; the whole-syllabus quiz shows nothing until "Finish quiz".
  const questionPanel = q && prog && set && (
    <>
      <article className="pr-q-card">
        <div className="pr-q-top">
          <span className="pr-q-num">{fill(p.qLabel, { n: current + 1 })}</span>
          {!set.full && <span className="pr-level">{fill(p.levelOf, { n: q.number })}</span>}
        </div>
        <MathText className="pr-q-text" text={q.question} />
        <p className="pr-q-meta">{p.aiLabel}{modelledOn(q) && ` · ${modelledOn(q)}`}</p>
      </article>
      <p className="pr-muted pr-exam-note">{set.full ? p.examNote : p.instantNote}</p>
      {q.steps.map((step, j) => (
        <fieldset key={j} className="pr-panel pr-step">
          <legend className="pr-step-title">
            {fill(p.stepOf, { n: j + 1, total: q.steps.length })} · <MathText text={step.title} />
          </legend>
          <div className="pr-options" role="radiogroup">
            {step.options.map((o, i) => {
              const on = prog.picks[j] === i;
              return (
                <button key={i} type="button" role="radio" aria-checked={on}
                  className={`pr-option${on ? " picked" : ""}`} onClick={() => choose(j, i)}>
                  <span className="pr-option-mark" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                  <MathText text={o.text} />
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );

  // One question's marking: the student's pick at each step and why it is right or wrong and,
  // for a wrong step, the correct working and why. Shown after each question and in the results.
  const resultCard = (x: QuizQuestion, i: number) => {
    const pr = progress[i];
    const r = x.steps.filter((_, j) => stepRight(x, pr, j)).length;
    return (
      <article key={i} className="pr-result">
        <header className="pr-result-head">
          <span className="pr-q-num">{fill(p.qLabel, { n: i + 1 })}</span>
          <span className="pr-chip">{x.topic}</span>
          <span className={`pr-result-tally${r === x.steps.length ? " all" : ""}`}>
            {fill(p.stepsTally, { n: r, total: x.steps.length })}
          </span>
          <button type="button" className={`pr-save${isSaved(x) ? " on" : ""}`} onClick={() => toggleSave(x)}
            aria-pressed={isSaved(x)} aria-label={isSaved(x) ? p.unsave : p.save} title={isSaved(x) ? p.unsave : p.save}>
            {isSaved(x) ? icons.bookmarkFilled : icons.bookmark}
          </button>
        </header>
        <MathText className="pr-q-text" text={x.question} />
        {x.steps.map((step, j) => {
          const pick = pr.picks[j];
          const mine = pick === null ? null : step.options[pick];
          const ok = stepRight(x, pr, j);
          const correct = step.options.find((o) => o.correct);
          return (
            <div key={j} className={`pr-res-step ${ok ? "ok" : "bad"}`}>
              <h4>
                <span className="pr-res-icon" aria-label={ok ? p.right : p.wrong}>{ok ? icons.check : icons.cross}</span>
                {fill(p.stepOf, { n: j + 1, total: x.steps.length })} · <MathText text={step.title} />
              </h4>
              <div className="pr-res-row">
                <span className="pr-res-label">{p.yourAnswer}</span>
                {mine ? <MathText text={mine.text} /> : <em className="pr-muted">{p.notAnswered}</em>}
                {mine?.why && <div className="pr-res-why"><MathText text={mine.why} /></div>}
              </div>
              {!ok && correct && (
                <div className="pr-res-row pr-res-correct">
                  <span className="pr-res-label">{p.correctStep}</span>
                  <MathText text={correct.text} />
                  {correct.why && <div className="pr-res-why"><MathText text={correct.why} /></div>}
                </div>
              )}
            </div>
          );
        })}
        <div className="pr-answer">
          <strong>{p.answer}</strong>
          <MathText text={x.answer} />
        </div>
        <FeedbackForm question={x} />
      </article>
    );
  };

  const resultsBody = (
    <>
      <section className="pr-score">
        <div className="pr-score-ring" style={{ ["--pct" as string]: `${result.pct}%` }}>
          <strong>{result.pct}%</strong>
        </div>
        <div>
          <h3>{fill(p.scoreSteps, { n: result.right, total: result.steps })}</h3>
          <p>{fill(p.scoreQuestions, { n: result.perfect, total: result.questions })}</p>
        </div>
      </section>
      {questions.map(resultCard)}
    </>
  );

  const browse = <button type="button" className="pr-btn-outline" onClick={close}>{p.running.browse}</button>;

  // Nothing to show yet: still writing Q1, or every question failed.
  const emptyBody = writing ? (
    <Notice art="/dashboard/bear-pencil.png" title={p.generating} text={p.generatingText}>
      <span className="pr-dots" aria-hidden="true"><i /><i /><i /></span>
      <div className="pr-row">{browse}</div>
    </Notice>
  ) : (
    <Notice art="/dashboard/bear-cheer.png" title={p.errors.failed} text={error ?? ""}>
      <div className="pr-row">{browse}</div>
    </Notice>
  );

  // The student is ahead of the AI: this question is still being written.
  const waitingBody = (
    <Notice art="/dashboard/bear-pencil.png" title={p.writingNext} text={fill(p.readyCount, { n: written, total })}>
      <span className="pr-dots" aria-hidden="true"><i /><i /><i /></span>
      <div className="pr-row">
        {current > 0 && (
          <button type="button" className="pr-btn-outline" onClick={() => go(current - 1)}>{icons.arrowLeft}{p.previous}</button>
        )}
        {browse}
      </div>
    </Notice>
  );

  // ---------- Focus overlay ----------
  const quizModal = set && (
    <div className="pr-modal-scrim" onClick={close}>
      <div className="pr-modal" role="dialog" aria-modal="true" aria-labelledby="pr-modal-title" tabIndex={-1}
        ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <header className="pr-modal-head">
          <div className="pr-modal-title">
            <span className="pr-chip">{nameOf(openKey ?? "")}</span>
            <h2 id="pr-modal-title">{submitted ? p.resultsTitle : p.quizTitle}</h2>
          </div>
          {total > 0 && !submitted && (
            <div className="pr-q-progress">
              <span>
                {fill(p.answeredOf, { n: doneCount, total })}
                {writing && <em className="pr-ready"> · {fill(p.readyCount, { n: written, total })}</em>}
              </span>
              <div><Progress value={doneCount} total={total} /><b>{pct}%</b></div>
            </div>
          )}
          <button type="button" className="pr-modal-close" onClick={close} aria-label={p.close} title={p.close}>
            {icons.cross}
          </button>
        </header>

        <div className="pr-modal-body">
          {written === 0 ? emptyBody : submitted ? resultsBody : waiting ? waitingBody
            : q && prog?.checked ? resultCard(q, current) : questionPanel}
        </div>

        {/* Last question, all written: a reminder of unanswered steps before finishing. */}
        {!submitted && set.full && q && onLast && !writing && unanswered > 0 && (
          <p className="pr-unanswered" role="status">{fill(p.unansweredWarn, { n: unanswered })}</p>
        )}
        {submitted ? (
          <footer className="pr-nav pr-modal-foot">
            <button type="button" className="pr-btn-outline" onClick={close}>{p.closeResults}</button>
            <button type="button" className="pr-btn-primary" onClick={startAgain} disabled={starting}>
              {set.full ? p.newFullQuiz : p.newSet} {icons.arrowRight}
            </button>
          </footer>
        ) : q && prog && !waiting && (
          <footer className="pr-nav pr-modal-foot">
            <button type="button" className="pr-btn-outline" onClick={() => go(current - 1)} disabled={current === 0}>
              {icons.arrowLeft}{p.previous}
            </button>
            <span>{fill(p.of, { n: current + 1, total })}</span>
            {!set.full && !prog.checked ? (
              <button type="button" className="pr-btn-primary" onClick={checkAnswer} disabled={prog.picks.some((x) => x === null)}>
                {p.checkAnswer} {icons.check}
              </button>
            ) : onLast && !writing ? (
              <button type="button" className="pr-btn-primary" onClick={finishQuiz}>{p.finishQuiz} {icons.check}</button>
            ) : (
              <button type="button" className="pr-btn-primary" onClick={() => go(current + 1)}>{p.next} {icons.arrowRight}</button>
            )}
          </footer>
        )}
      </div>
    </div>
  );

  let body: ReactNode;
  if (tab === "saved") {
    const sl = p.savedList;
    const topicsSaved = [...new Set(saved.map((s) => s.topic))].sort();
    const q = savedQuery.trim().toLowerCase();
    const shown = saved.filter((s) => (!savedTopic || s.topic === savedTopic)
      && (!q || s.question.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q)));
    const savedOn = (iso: string) => new Date(iso).toLocaleDateString(lang === "ta" ? "ta-LK" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" });

    body = savedStatus === "loading" ? (
      <p className="pr-saved-status" role="status">{sl.loading}</p>
    ) : savedStatus === "failed" ? (
      <p className="pr-saved-status" role="alert">
        {sl.loadFailed} <button type="button" className="pr-link" onClick={loadSavedList}>{sl.retry}</button>
      </p>
    ) : saved.length === 0 ? (
      <section className="pr-card pr-wide">
        <Notice art="/dashboard/bear-cheer.png" title={p.savedEmpty} text={p.savedEmptyText} />
      </section>
    ) : (
      <>
        <div className="pr-saved-bar">
          <strong>{fill(sl.count, { n: saved.length })}</strong>
          <input type="search" value={savedQuery} onChange={(e) => setSavedQuery(e.target.value)}
            placeholder={sl.search} aria-label={sl.search} />
          {topicsSaved.length > 1 && (
            <select value={savedTopic} onChange={(e) => setSavedTopic(e.target.value)} aria-label={sl.allTopics}>
              <option value="">{sl.allTopics}</option>
              {topicsSaved.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </div>
        {savedNote && <p className="pr-saved-status" role="alert">{savedNote}</p>}
        {shown.length === 0 ? <p className="pr-saved-status">{sl.noMatch}</p> : (
          <div className="pr-saved">
            {shown.map((s) => (
              <article key={s.id} className="pr-card pr-saved-card">
                <div className="pr-q-top">
                  <span className="pr-chip"><span aria-hidden="true">{topicGlyph(s.topic)}</span> {s.topic}</span>
                  <span className="pr-saved-date">{fill(sl.savedOn, { date: savedOn(s.saved_at) })}</span>
                  <button type="button" className="pr-link" onClick={() => removeSaved(s)}>{p.remove}</button>
                </div>
                <MathText className="pr-q-text" text={s.question} />
                <details>
                  <summary>{p.showAnswer}</summary>
                  <MathText text={s.answer} />
                </details>
              </article>
            ))}
          </div>
        )}
      </>
    );
  } else {
    body = <>{runningStrip}{picker}</>;
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
        {tabs.map((x) => (
          <button key={x.key} type="button" className={`pr-tab${tab === x.key ? " active" : ""}`}
            aria-pressed={tab === x.key} onClick={() => setTab(x.key)}>
            {x.icon}{x.label}
          </button>
        ))}
      </nav>

      {body}
      {quizModal}
    </main>
  );
}
