import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { ApiError, subscriptionApi, type SubscriptionRow, type SubscriptionSummary } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import "../../styles/account.css";

// The plan comes from GET /subscription. Online payment isn't connected yet
// (payments_enabled: false), so the plan cards explain that instead of starting a checkout.

const LIVE = ["trialing", "active"];

export function SubscriptionPage() {
  const { lang, t } = useLanguage();
  const s = t.dashboard.subscription;
  const navigate = useNavigate();
  const [data, setData] = useState<SubscriptionSummary>();
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    subscriptionApi.get().then(setData, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setFailed(true);
    });
  }, [navigate]);
  useEffect(() => { load(); }, [load]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "ta" ? "ta-LK" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" });
  // Names an admin set on Admin > Plans win; the copy file covers the trial and old plans.
  const planName = (key: string) => {
    const p = data?.plans.find((x) => x.key === key);
    return p ? (lang === "ta" ? p.name_ta : p.name_en) : s.planNames[key as keyof typeof s.planNames] ?? key;
  };
  const lkr = (n: number) => n.toLocaleString("en-LK");

  if (failed) {
    return (
      <main className="db-content ac-page">
        <p className="ac-status" role="alert">{s.loadFailed} <button type="button" className="db-link" onClick={load}>{s.retry}</button></p>
      </main>
    );
  }
  if (!data) return <main className="db-content ac-page"><p className="ac-status" role="status">{s.loading}</p></main>;

  const cur = data.current;
  const live = !!cur && LIVE.includes(cur.status);

  return (
    <main className="db-content ac-page">
      <header className="ac-head">
        <span className="ac-head-icon" aria-hidden="true">{icons.crown}</span>
        <div>
          <h1>{s.title}</h1>
          <p>{s.subtitle}</p>
        </div>
      </header>

      {/* ---------- Current plan ---------- */}
      <section className="ac-card ac-current" aria-labelledby="ac-current-title">
        <p className="ac-eyebrow" id="ac-current-title">{s.current}</p>
        {cur ? <CurrentPlan row={cur} name={planName(cur.plan)} date={date} /> : <h2>{s.noPlan}</h2>}
        {cur && !live && <p className="ac-note">{s.expiredText}</p>}
      </section>

      {/* ---------- Plans ---------- */}
      <section aria-labelledby="ac-plans-title">
        <div className="ac-section-head">
          <div>
            <h2 id="ac-plans-title">{s.upgradeTitle}</h2>
            <p>{s.upgradeText}</p>
          </div>
          <a href="/#pricing" className="db-btn-outline db-btn-sm">{s.comparePlans}</a>
        </div>
        {!data.payments_enabled && (
          <p className="ac-banner" role="note">{icons.clock}<span><strong>{s.soon}.</strong> {s.soonText}</span></p>
        )}
        <div className="ac-plans">
          {data.plans.map((p) => {
            // Free is what a student is on when no plan (not even the trial) is running.
            const mine = p.billing === "free" ? !live : live && cur?.plan === p.key;
            return (
              <article key={p.key} className={`ac-card ac-plan${p.highlight ? " best" : ""}${mine ? " mine" : ""}`}>
                {p.highlight && <span className="ac-ribbon">{s.bestValue}</span>}
                <h3>{planName(p.key)}</h3>
                <p className="ac-price">
                  <span>LKR</span> <strong>{lkr(p.price_lkr)}</strong> <span>{s.billing[p.billing]}</span>
                </p>
                <p className="ac-blurb">{lang === "ta" ? p.blurb_ta : p.blurb_en}</p>
                {mine ? (
                  <span className="ac-pill on">{s.yourPlan}</span>
                ) : p.billing === "free" ? null : (
                  <button type="button" className="db-btn-primary ac-choose" disabled={!data.payments_enabled}
                    title={data.payments_enabled ? undefined : s.soon}>
                    {data.payments_enabled ? fill(s.choose, { plan: planName(p.key) }) : s.soon}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- History ---------- */}
      {data.history.length > 0 && (
        <section className="ac-card" aria-labelledby="ac-history-title">
          <h2 id="ac-history-title" className="ac-card-title">{s.history}</h2>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr><th>{s.colPlan}</th><th>{s.colStatus}</th><th>{s.colFrom}</th><th>{s.colTo}</th></tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id}>
                    <td>{planName(h.plan)}</td>
                    <td><span className={`ac-pill ${h.status}`}>{s.status[h.status]}</span></td>
                    <td>{date(h.starts_at)}</td>
                    <td>{date(h.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="ac-foot"><Link to="/dashboard" className="db-link">{t.dashboard.backHome}</Link></p>
    </main>
  );
}

function CurrentPlan({ row, name, date }: { row: SubscriptionRow; name: string; date: (iso: string) => string }) {
  const { t } = useLanguage();
  const s = t.dashboard.subscription;
  const live = LIVE.includes(row.status);
  const total = Math.max(1, Math.round((Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 86_400_000));
  const used = Math.min(total, Math.max(1, total - row.days_left + 1));
  return (
    <>
      <div className="ac-current-row">
        <h2>{name}</h2>
        <span className={`ac-pill ${row.status}`}>{s.status[row.status]}</span>
      </div>
      {live ? (
        <>
          <p className="ac-big">{fill(s.daysLeft, { n: row.days_left })}</p>
          <div className="ac-meter" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={used}
            aria-label={fill(s.trialDay, { used, total })}>
            <span style={{ width: `${(used / total) * 100}%` }} />
          </div>
          <p className="ac-muted">{fill(s.trialDay, { used, total })} · {fill(s.endsOn, { date: date(row.ends_at) })}</p>
        </>
      ) : (
        <p className="ac-muted">{fill(s.endedOn, { date: date(row.ends_at) })}</p>
      )}
    </>
  );
}
