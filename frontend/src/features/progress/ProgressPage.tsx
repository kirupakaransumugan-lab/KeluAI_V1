import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import {
  progressApi, type ProgressRange, type ProgressReport, type ProgressTopic, type ProgressWeek,
} from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import { WeekBars } from "./WeekBars";
import "../../styles/progress.css";

// Everything comes from GET /progress/report, which is built from the student's own saved
// answers. A figure with nothing behind it is shown as a dash or "Not tried", never as 0%.

const RANGES: ProgressRange[] = ["7", "30", "all"];
const TOPICS_SHOWN = 5;

const pctText = (value: number | null) => (value === null ? "–" : `${value}%`);

/** A small trend line for a card. Needs two weeks with data to say anything. */
function Spark({ weeks, pick }: { weeks: ProgressWeek[]; pick: (w: ProgressWeek) => number | null }) {
  const values = weeks.map(pick);
  const known = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (known.length < 2) return null;
  const nums = known.map((p) => p.v);
  const low = Math.min(...nums), span = Math.max(...nums) - low || 1;
  const points = known.map((p) => `${(p.i / (values.length - 1)) * 60},${22 - ((p.v - low) / span) * 18}`).join(" ");
  return (
    <svg className="pg-spark" viewBox="0 0 60 26" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ icon, tone, label, value, foot, spark }: {
  icon: ReactNode; tone: string; label: string; value: string; foot: ReactNode; spark?: ReactNode;
}) {
  return (
    <section className="pg-card pg-kpi">
      <span className={`pg-kpi-icon ${tone}`}>{icon}</span>
      <div className="pg-kpi-copy">
        <h2>{label}</h2>
        <strong>{value}</strong>
        <p>{foot}</p>
      </div>
      {spark}
    </section>
  );
}

function CardHead({ icon, title, text, side }: { icon: ReactNode; title: string; text: string; side?: ReactNode }) {
  return (
    <header className="pg-head">
      <span className="pg-kpi-icon pg-pink">{icon}</span>
      <div className="pg-head-copy">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {side}
    </header>
  );
}

export function ProgressPage() {
  const { lang, t } = useLanguage();
  const c = t.dashboard.progress;
  const [range, setRange] = useState<ProgressRange>("30");
  const [report, setReport] = useState<ProgressReport>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let live = true;
    setFailed(false);
    progressApi.report(range).then((r) => { if (live) setReport(r); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [range, attempt]);

  const locale = lang === "ta" ? "ta-LK" : "en-LK";
  const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const when = (iso: string) => new Date(iso).toLocaleString(locale, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo",
  });

  const header = (
    <header className="pg-top">
      <div>
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
      </div>
      <div className="pg-range" role="group" aria-label={c.rangeLabel}>
        {RANGES.map((r) => (
          <button key={r} type="button" className={r === range ? "active" : ""} aria-pressed={r === range}
            onClick={() => setRange(r)}>{c.ranges[r]}</button>
        ))}
      </div>
    </header>
  );

  if (failed || !report) {
    return (
      <main className="db-content pg-page">
        {header}
        <section className="pg-card pg-state" role={failed ? "alert" : "status"}>
          {failed ? (
            <>
              <h2>{c.errorTitle}</h2>
              <p>{c.errorText}</p>
              <button type="button" className="db-btn-primary" onClick={() => setAttempt((a) => a + 1)}>{c.retry}</button>
            </>
          ) : <p>{c.loading}</p>}
        </section>
      </main>
    );
  }

  const { mastery, accuracy, streak, topics_covered: covered, weekly, daily, topics, recent } = report;
  const known = weekly.filter((w) => w.score !== null);
  const first = known[0], last = known[known.length - 1];
  const change = mastery.change;

  const doneDays = daily.filter((d) => d.state === "done").length;
  const countedDays = daily.filter((d) => d.state !== "before").length;
  const hasBefore = countedDays < daily.length;

  const topicRow = (topic: ProgressTopic) => {
    const name = topic.name[lang];
    const open = openTopic === topic.key;
    const weak = topic.pct !== null && topic.pct < 50;
    return (
      <li key={topic.key} className="pg-topic">
        <button type="button" className="pg-topic-row" aria-expanded={open}
          onClick={() => setOpenTopic(open ? null : topic.key)}>
          <span className="pg-topic-name">{name}</span>
          <span className="pg-track">
            {topic.pct !== null && <span className={weak ? "weak" : ""} style={{ width: `${topic.pct}%` }} />}
          </span>
          <span className={`pg-topic-pct${topic.pct === null ? " none" : ""}`}>
            {topic.pct === null ? c.notTried : `${topic.pct}%`}
          </span>
          {icons.chevronRight}
        </button>
        {open && (
          <p className="pg-topic-detail">
            {topic.pct === null ? c.topicNone : [
              fill(c.topicSteps, { right: topic.steps_right, total: topic.steps_total }),
              fill(c.questionsCount, { n: topic.questions }),
              topic.last_at && fill(c.topicLast, { when: when(topic.last_at) }),
            ].filter(Boolean).join(" · ")}
          </p>
        )}
      </li>
    );
  };

  const strand = (key: "pure" | "applied", title: string) => {
    const rows = topics.filter((x) => x.strand === key);
    const tried = rows.some((x) => x.pct !== null);
    const all = showAll[key];
    return (
      <section className="pg-strand" aria-label={title}>
        <h3>{title}</h3>
        <ul>{(all ? rows : rows.slice(0, TOPICS_SHOWN)).map(topicRow)}</ul>
        {key === "applied" && !tried && <p className="pg-note">{c.appliedNote}</p>}
        {rows.length > TOPICS_SHOWN && (
          <button type="button" className="pg-more" onClick={() => setShowAll((s) => ({ ...s, [key]: !all }))}>
            {all ? c.showFewer : fill(c.showAll, { n: rows.length })}
          </button>
        )}
      </section>
    );
  };

  return (
    <main className="db-content pg-page">
      {header}

      {!report.has_answers && (
        <section className="pg-card pg-start">
          <img src="/dashboard/bear-cheer.png" alt="" />
          <div>
            <h2>{c.startTitle}</h2>
            <p>{c.startText}</p>
          </div>
          <Link to="/dashboard/practice" className="db-btn-primary pg-start-btn">{c.startAction} {icons.arrowRight}</Link>
        </section>
      )}

      <div className="pg-kpis">
        <Kpi icon={icons.chart} tone="pg-pink" label={c.mastery} value={pctText(mastery.value)}
          spark={<Spark weeks={weekly} pick={(w) => w.score} />}
          foot={change === null ? c.masteryNoChange : (
            <span className={change > 0 ? "pg-up" : change < 0 ? "pg-down" : ""}>
              {fill(c.masteryChange, { n: change > 0 ? `+${change}` : `${change}` })}
            </span>
          )} />
        <Kpi icon={icons.book} tone="pg-pink" label={c.topicsCovered}
          value={`${covered.covered} / ${covered.total}`}
          foot={fill(c.topicsLeft, { n: covered.total - covered.covered })} />
        <Kpi icon={icons.target} tone="pg-amber" label={c.accuracy} value={pctText(accuracy.value)}
          spark={<Spark weeks={weekly} pick={(w) => w.accuracy} />}
          foot={fill(c.questionsAnswered, { n: accuracy.questions })} />
        <Kpi icon={icons.flame} tone="pg-coral" label={c.streak}
          value={fill(streak.current === 1 ? c.streakDay : c.streakDays, { n: streak.current })}
          spark={<Spark weeks={weekly} pick={(w) => (w.questions ? w.active_days : null)} />}
          foot={fill(c.streakBest, { n: streak.best })} />
      </div>

      <div className="pg-two">
        <section className="pg-card pg-panel">
          <CardHead icon={icons.chart} title={c.weeklyTitle}
            text={first && last && first !== last
              ? fill(c.weeklyChange, { a: first.score ?? 0, b: last.score ?? 0, n: weekly.length })
              : fill(c.weeklyText, { n: weekly.length })} />
          <WeekBars weeks={weekly} />
        </section>

        <section className="pg-card pg-panel">
          <CardHead icon={icons.calendar} title={c.dailyTitle} text={c.dailyText}
            side={<span className="pg-daily-count">{fill(c.dailyCount, { n: doneDays, total: countedDays })}</span>} />
          <div className={`pg-days${daily.length <= 7 ? " pg-days-week" : ""}`} role="list" aria-label={c.dailyTitle}>
            {daily.map((d, i) => {
              const isToday = i === daily.length - 1;
              return (
                <span key={d.date} role="listitem" className={`pg-day ${d.state}${isToday ? " is-today" : ""}`}
                  title={`${day(d.date)}: ${c.dayStates[d.state]}`}
                  aria-label={`${day(d.date)}: ${c.dayStates[d.state]}`}>
                  {d.state === "done" && icons.check}
                </span>
              );
            })}
          </div>
          <div className="pg-legend">
            <span><i className="pg-day done" />{c.dayStates.done}</span>
            <span><i className="pg-day missed" />{c.dayStates.missed}</span>
            <span><i className="pg-day today" />{c.dayStates.today}</span>
            {hasBefore && <span><i className="pg-day before" />{c.dayStates.before}</span>}
          </div>
        </section>
      </div>

      <section className="pg-card pg-panel">
        <CardHead icon={icons.chart} title={c.topicsTitle} text={c.topicsText} />
        <div className="pg-strands">
          {strand("pure", c.pure)}
          {strand("applied", c.applied)}
        </div>
      </section>

      <section className="pg-card pg-panel">
        <CardHead icon={icons.doc} title={c.recentTitle} text={c.recentText} />
        {recent.length ? (
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead>
                <tr>
                  <th scope="col">{c.colType}</th>
                  <th scope="col">{c.colTopic}</th>
                  <th scope="col">{c.colScore}</th>
                  <th scope="col">{c.colDate}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.set_id}>
                    <td>{c.kinds[r.kind] ?? r.kind}</td>
                    <td>{r.topic ? r.topic[lang] : c.mixedTopics}</td>
                    <td>{r.perfect} / {r.questions}</td>
                    <td>{when(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pg-muted">{c.recentEmpty}</p>}
      </section>
    </main>
  );
}
