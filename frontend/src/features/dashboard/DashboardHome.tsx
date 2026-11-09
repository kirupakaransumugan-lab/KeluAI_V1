import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import { ApiError, progressApi, quizzesApi, type DashboardSummary, type ProgressTopic } from "../../services/api";
import { daysLeft, fill } from "../../utils/dates";
import { loadConversations } from "../ai-tutor/conversations";
import { topicGlyph } from "../practice/topicIcon";
import { FullQuizLock } from "./FullQuizLock";
import { icons } from "./icons";

// The four cards come from GET /progress/dashboard, built from the student's saved quiz marks.
// Tutor chats are still kept in this browser (see ai-tutor/conversations.ts), so "Continue"
// adds the latest one from there next to the recent quizzes from the server.

function greetingKey(hour = new Date().getHours()): "morning" | "afternoon" | "evening" {
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="db-card">
      <header className="db-card-head">
        <span className="db-plum">{icon}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function EmptyState({ icon, title, text, action }: {
  icon: ReactNode; title: string; text: string; action?: { to: string; label: string };
}) {
  return (
    <div className="db-empty">
      <span className="db-empty-icon" aria-hidden="true">{icon}</span>
      <div className="db-empty-copy">
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {action && <Link to={action.to} className="db-btn-outline">{action.label}</Link>}
    </div>
  );
}

/** A topic row with a link that starts a quiz on it (PracticePage reads ?topic=). */
function TopicRow({ topic, note, label }: { topic: ProgressTopic; note: string; label: string }) {
  const { lang } = useLanguage();
  return (
    <li className="db-row">
      <span className="db-row-icon" aria-hidden="true">{topicGlyph(topic.name.en)}</span>
      <div className="db-row-copy">
        <strong>{topic.name[lang]}</strong>
        <span>{note}</span>
      </div>
      {topic.pct !== null && (
        <span className="db-meter" aria-hidden="true"><span style={{ width: `${topic.pct}%` }} /></span>
      )}
      <Link to={`/dashboard/practice?topic=${encodeURIComponent(topic.key)}`} className="db-btn-outline db-btn-sm">{label}</Link>
    </li>
  );
}

export function DashboardHome() {
  const { user } = useOutletContext<DashboardContext>();
  const { lang, t } = useLanguage();
  const d = t.dashboard;
  const e = d.empty;
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const firstName = user.full_name.split(" ")[0];
  const trialDays = daysLeft(user.trial_ends_at);
  const h = d.home;

  const [summary, setSummary] = useState<DashboardSummary>();
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    progressApi.dashboard().then(setSummary, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setFailed(true);
    });
  }, [navigate]);
  useEffect(() => { load(); }, [load]);

  const [lastChat] = useState(() => loadConversations(user.id)
    .filter((c) => c.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt)[0]);

  // "Start quiz" is the 10-question full syllabus quiz, open only in the exam year. Ask the server
  // (it owns the rule); students who can't take it yet get a note and a way to Practice instead.
  const [checking, setChecking] = useState(false);
  const [locked, setLocked] = useState(false);
  const startQuiz = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const { full_quiz } = await quizzesApi.subjects(lang);
      if (full_quiz.allowed) navigate("/dashboard/practice?start=full");
      else setLocked(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else navigate("/dashboard/practice");          // can't check now: Practice shows what's open
    } finally {
      setChecking(false);
    }
  };

  const ask = (ev: FormEvent) => {
    ev.preventDefault();
    const q = question.trim();
    if (q) navigate(`/dashboard/tutor?q=${encodeURIComponent(q)}`);
  };

  return (
    <main className="db-content">
      {/* ---------- Greeting + trial + bear ---------- */}
      <section className="db-hero">
        <div className="db-hero-copy">
          <div className="db-hero-head">
            <div>
              <h1 className="db-greeting">
                {fill(d.greeting[greetingKey()], { name: firstName })} <span aria-hidden="true">👋</span>
              </h1>
              {user.medium && (
                <p className="db-sub">
                  {user.al_exam_year && fill(d.examYear, { n: user.al_exam_year })} · {d.medium[user.medium]}
                </p>
              )}
            </div>
            {trialDays !== null && (
              <div className="db-chips">
                <div className="db-chip">
                  <span className="db-chip-icon db-plum">{icons.calendar}</span>
                  <span><strong>{fill(d.trialDays, { n: trialDays })}</strong>{d.trialLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="db-goal">
            <div className="db-goal-copy">
              <p className="db-eyebrow">{d.goalEyebrow} <span className="db-amber">{icons.sparkle}</span></p>
              <h2>{d.goalTitle}</h2>
              <p className="db-meta">{icons.clock}{d.goalMeta}</p>
            </div>
            <button type="button" className="db-btn-primary" onClick={() => void startQuiz()}
              disabled={checking} aria-busy={checking}>
              {checking ? h.fullLock.checking : d.startQuiz} {icons.arrowRight}
            </button>
            <img className="db-goal-art" src="/dashboard/goal.png" alt="" />
            {locked && (
              <FullQuizLock examYear={user.al_exam_year} onClose={() => setLocked(false)}
                onGo={() => { setLocked(false); navigate("/dashboard/practice"); }} />
            )}
          </div>
        </div>
        <div className="db-hero-art" aria-hidden="true">
          <p className="db-bubble">{d.cheer} <span aria-hidden="true">💪</span></p>
          <img src="/dashboard/bear-desk.png" alt="" />
        </div>
      </section>

      {/* ---------- Cards: from GET /progress/dashboard ---------- */}
      {failed && (
        <p className="db-load-error" role="alert">
          {h.loadFailed} <button type="button" className="db-link" onClick={load}>{h.retry}</button>
        </p>
      )}
      <div className="db-grid" aria-busy={!summary && !failed}>
        <Card icon={icons.book} title={d.plan}>
          {summary?.plan.length ? (
            <ul className="db-rows">
              {summary.plan.map((x) => (
                <TopicRow key={x.key} topic={x} label={h.practice}
                  note={x.reason === "weak" ? fill(h.planWeak, { pct: x.pct ?? 0 }) : h.planNew} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={icons.book} title={e.plan.title} text={e.plan.text}
              action={{ to: "/dashboard/practice", label: d.startQuiz }} />
          )}
        </Card>

        <Card icon={icons.target} title={d.needsWork}>
          {summary?.needs_work.length ? (
            <ul className="db-rows">
              {summary.needs_work.map((x) => (
                <TopicRow key={x.key} topic={x} label={h.practice}
                  note={fill(h.topicScore, { pct: x.pct ?? 0, n: x.questions })} />
              ))}
            </ul>
          ) : summary?.has_answers ? (
            <EmptyState icon={icons.target} title={h.allGood.title} text={h.allGood.text} />
          ) : (
            <EmptyState icon={icons.target} title={e.needsWork.title} text={e.needsWork.text} />
          )}
        </Card>

        <Card icon={icons.history} title={d.continueTitle}>
          {summary?.recent.length || lastChat ? (
            <ul className="db-rows">
              {lastChat && (
                <li className="db-row">
                  <span className="db-row-icon" aria-hidden="true">{icons.chat}</span>
                  <div className="db-row-copy">
                    <strong>{lastChat.title || d.tutor.untitled}</strong>
                    <span>{h.tutorChat}</span>
                  </div>
                  <Link to="/dashboard/tutor" className="db-btn-outline db-btn-sm">{h.resume}</Link>
                </li>
              )}
              {summary?.recent.map((r) => (
                <li className="db-row" key={r.set_id}>
                  <span className="db-row-icon" aria-hidden="true">{icons.pencil}</span>
                  <div className="db-row-copy">
                    <strong>{r.topic ? fill(h.quiz, { topic: r.topic[lang] }) : h.mixedQuiz}</strong>
                    <span>{fill(h.result, { p: r.perfect, n: r.questions })}</span>
                  </div>
                  <Link to="/dashboard/practice" className="db-btn-outline db-btn-sm">{h.practice}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={icons.chat} title={e.continue.title} text={e.continue.text}
              action={{ to: "/dashboard/tutor", label: d.ask }} />
          )}
        </Card>

        <Card icon={icons.bars} title={d.thisWeek}>
          {summary && summary.week.questions > 0 ? (
            <div className="db-week">
              <div className="db-stats">
                <div><strong>{summary.week.questions}</strong><span>{h.questions}</span></div>
                <div><strong>{summary.week.score === null ? "-" : `${summary.week.score}%`}</strong><span>{h.avgScore}</span></div>
                <div><strong>{summary.week.streak}</strong><span>{h.streak}</span></div>
              </div>
              <ol className="db-days">
                {summary.week.days.map((day, i) => (
                  <li key={day.date} className={`db-day ${day.state}`} title={day.date}>
                    <span className="db-dot" aria-hidden="true">{day.state === "done" ? icons.checks : null}</span>
                    <span>{h.dayNames[i]}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <EmptyState icon={icons.chart} title={e.week.title} text={e.week.text} />
          )}
        </Card>
      </div>

      {/* ---------- Ask bar ---------- */}
      <form className="db-ask" onSubmit={ask}>
        <span className="db-ask-spark">{icons.sparkle}</span>
        <input value={question} onChange={(ev) => setQuestion(ev.target.value)}
          placeholder={d.askPlaceholder} aria-label={d.askPlaceholder} />
        <button type="button" className="db-icon-btn" aria-label={d.voice}>{icons.mic}</button>
        <button type="button" className="db-icon-btn" aria-label={d.attach}>{icons.clip}</button>
        <button type="submit" className="db-ask-send" aria-label={d.ask}>{icons.arrowUpRight}</button>
      </form>
    </main>
  );
}

export function ComingSoon() {
  const { t } = useLanguage();
  const d = t.dashboard;
  return (
    <main className="db-content">
      <section className="db-card db-soon">
        <img src="/dashboard/partner.png" alt="" />
        <h1>{d.comingSoon}</h1>
        <p>{d.comingSoonText}</p>
        <Link to="/dashboard" className="db-btn-primary">{d.backHome} {icons.arrowRight}</Link>
      </section>
    </main>
  );
}
