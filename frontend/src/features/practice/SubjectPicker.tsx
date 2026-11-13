import { useLanguage } from "../../app/providers";
import type { FullQuizInfo, PracticeSubject } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import type { QuizState } from "./practiceStore";
import { topicGlyph } from "./topicIcon";

/** Colour band for a topic's score: the same 40 / 75 cut-offs as the progress pages. */
const scoreBand = (pct: number) => (pct >= 75 ? "good" : pct >= 40 ? "mid" : "low");

/** Every topic, always in view: clicking one starts its quiz in the background (or opens the one
 *  already under way), and each tile shows how that quiz is coming along. */
export function SubjectPicker({ subjects, fullQuiz, fullState, states, statusText, starting, error, onPick, onNewQuiz, onStartFull }: {
  subjects: PracticeSubject[] | undefined;
  fullQuiz: FullQuizInfo | undefined;
  fullState: QuizState | null;
  states: Record<string, QuizState | null>;
  statusText: (state: QuizState) => string;
  starting: boolean;
  error: string | null;
  onPick: (key: string) => void;          // open the topic's quiz, or start one
  onNewQuiz: (key: string) => void;       // always a new quiz
  onStartFull: () => void;
}) {
  const { lang, t } = useLanguage();
  const p = t.dashboard.practice;
  const live = (key: string) => {
    const state = states[key];
    return state && state.state !== "done" ? state : null;
  };

  const tiles = (list: PracticeSubject[], title: string) => (
    <section className="pr-subjects" aria-label={title}>
      <h3>{title}</h3>
      <div className="pr-subject-list">
        {list.map((s) => {
          const state = live(s.key);
          return (
            <button key={s.key} type="button" onClick={() => onPick(s.key)}
              className={`pr-subject ${s.strand}${state ? ` live ${state.state}` : ""}${s.pct === null ? " new" : ` ${scoreBand(s.pct)}`}`}>
              <span className="pr-glyph" aria-hidden="true">{topicGlyph(s.name.en)}</span>
              <span className="pr-subject-copy">
                <strong>{s.name[lang]}</strong>
                {state ? (
                  <small className="pr-subject-status">
                    {state.state === "writing" && <span className="pr-dots" aria-hidden="true"><i /><i /><i /></span>}
                    {state.state === "writing" ? fill(p.running.writingShort, { n: state.ready, total: state.total }) : statusText(state)}
                  </small>
                ) : (
                  <>
                    <small>{s.pct === null ? p.notTried : fill(p.subjectScore, { pct: s.pct })}</small>
                    {s.quizzes > 0 && <small>{fill(p.mine.quizzes, { n: s.quizzes })}</small>}
                  </>
                )}
              </span>
              <span className="pr-subject-go" aria-hidden="true">{icons.chevronRight}</span>
              {!state && s.pct !== null && (
                <span className="pr-subject-bar" aria-hidden="true"><span style={{ width: `${Math.max(s.pct, 3)}%` }} /></span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
  const when = (iso: string) => new Date(iso).toLocaleDateString(lang === "ta" ? "ta-LK" : "en-LK", { day: "numeric", month: "short" });
  const practised = (subjects ?? []).filter((s) => s.quizzes > 0)
    .sort((a, b) => b.attempts[0].at.localeCompare(a.attempts[0].at));
  const strand = (key: "pure" | "applied", title: string) => tiles((subjects ?? []).filter((s) => s.strand === key), title);

  const ready = fullQuiz ? fullQuiz.pure + fullQuiz.applied : 0;
  const fullLive = fullState && fullState.state !== "done" ? fullState : null;
  const full = fullQuiz && (
    <article className={`pr-card pr-full${fullQuiz.allowed ? "" : " locked"}`}>
      <span className="pr-full-icon" aria-hidden="true">{icons.target}</span>
      <div className="pr-full-copy">
        <h2>{p.fullTitle}</h2>
        <p>{!fullQuiz.allowed ? p.fullLocked : fullLive ? statusText(fullLive) : !ready ? p.fullSoon
          : fill(p.fullText, { n: ready, pure: fullQuiz.pure, applied: fullQuiz.applied })}</p>
      </div>
      {fullQuiz.allowed && (ready > 0 || fullLive) && (
        <button type="button" className="pr-btn-primary pr-btn-sm" onClick={onStartFull} disabled={starting}>
          {fullLive ? p.running.continueQuiz : p.start} {icons.arrowRight}
        </button>
      )}
    </article>
  );

  return (
    <div className="pr-pick-subject">
      {full}
      <div>
        <h2 className="pr-choose-title">{p.subjectTitle}</h2>
        <p className="pr-muted">{p.subjectText}</p>
      </div>
      {error && <p className="pr-error" role="alert">{error}</p>}
      {subjects ? (
        <>
          {practised.length > 0 && (
            <section className="pr-subjects" aria-label={p.mine.title}>
              <h3>{p.mine.title}</h3>
              <div className="pr-mine-grid">
                {practised.map((s) => {
                  const state = live(s.key);
                  return (
                    <article key={s.key} className="pr-card pr-mine-card">
                      <header>
                        <h4>{s.name[lang]}</h4>
                        <strong>{s.pct}%</strong>
                      </header>
                      <span className="pr-bar"><span style={{ width: `${s.pct}%` }} /></span>
                      <p className="pr-muted">{fill(p.mine.quizzes, { n: s.quizzes })}</p>
                      <ul className="pr-attempts" aria-label={p.mine.history}>
                        {s.attempts.slice(0, 3).map((a) => (
                          <li key={a.set_id}>
                            <span>{when(a.at)}</span>
                            <span>{a.perfect} / {a.questions}</span>
                            <b>{a.pct}%</b>
                          </li>
                        ))}
                      </ul>
                      {state ? (
                        <button type="button" className="pr-btn-outline pr-btn-sm" onClick={() => onPick(s.key)}>
                          {statusText(state)}
                        </button>
                      ) : (
                        <button type="button" className="pr-btn-primary pr-btn-sm" onClick={() => onNewQuiz(s.key)}>
                          {p.mine.again} {icons.arrowRight}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {strand("pure", p.pure)}
          {strand("applied", p.applied)}
        </>
      ) : !error && <p className="pr-muted" role="status">{p.loadingTopics}</p>}
    </div>
  );
}
