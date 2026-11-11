import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { icons } from "../dashboard/icons";
import {
  ApiError, adminApi, type AdminKpi, type AdminOverview as Overview, type AiUsageSummary, type AttentionItem,
  type MediumFilter, type OverviewDays,
} from "../../services/api";
import { SignupsChart } from "./SignupsChart";

// Admin Overview. Real numbers come from GET /admin/overview (users, profiles, subscriptions,
// payments, open work items and AI usage). Anything still not recorded says "not tracked yet"
// and what would fill it - never a made-up number.

const RANGES: { days: OverviewDays; label: string }[] = [
  { days: 7, label: "Last 7 days" }, { days: 30, label: "Last 30 days" }, { days: 90, label: "Last 90 days" },
];
const MEDIUMS: { value: MediumFilter; label: string }[] = [
  { value: "all", label: "All mediums" }, { value: "en", label: "English medium" }, { value: "ta", label: "Tamil medium" },
];
const STATUS: Record<Overview["latest_signups"][number]["status"], string> = {
  trial: "In trial", paid: "Paid", expired: "Trial ended", cancelled: "Cancelled",
};

const PLAN_LABEL: Record<string, string> = { monthly: "Monthly", until_exam: "Until exam", class: "Class plan", annual: "Annual" };
const num = (v: number) => v.toLocaleString("en-LK");
const when = (iso: string) => new Date(iso).toLocaleString("en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Kpi({ icon, tone, label, kpi, suffix = "", days, link }: {
  icon: ReactNode; tone: string; label: string; kpi: AdminKpi | null; suffix?: string; days: number;
  link: { to: string; label: string };
}) {
  const ch = kpi?.change_pct ?? null;
  return (
    <article className="ad-kpi">
      <div className="ad-kpi-top">
        <span className={`ad-badge ${tone}`}>{icon}</span>
        <div>
          <h3>{label}</h3>
          <strong className="ad-kpi-value">{kpi?.value == null ? "—" : `${num(kpi.value)}${suffix}`}</strong>
        </div>
      </div>
      <p className="ad-kpi-change">
        {kpi == null ? <span className="ad-muted">Not tracked yet</span>
          : ch == null ? <span className="ad-muted">No earlier data to compare</span>
          : (
            <>
              <span className={ch >= 0 ? "ad-up" : "ad-down"}>{ch >= 0 ? icons.arrowUp : icons.arrowDown}{Math.abs(ch)}%</span>
              <span className="ad-muted">vs previous {days} days</span>
            </>
          )}
      </p>
      <Link to={link.to} className="ad-link">{link.label} {icons.arrowRight}</Link>
    </article>
  );
}

function Card({ icon, tone, title, sub, action, className = "", children }: {
  icon: ReactNode; tone: string; title: string; sub?: string; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={`ad-card ${className}`}>
      <header className="ad-card-head">
        <span className={`ad-badge ${tone}`}>{icon}</span>
        <div className="ad-card-title">
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Monthly revenue as plain bars, with the amount written on each (no hover needed). */
function RevenueBars({ months }: { months: Overview["revenue_per_month"] }) {
  const most = Math.max(1, ...months.map((m) => m.amount_lkr));
  if (!months.some((m) => m.amount_lkr)) return <p className="ad-muted ad-pad">No payments recorded in the last six months.</p>;
  return (
    <ul className="ad-rev" aria-label="Revenue per month">
      {months.map((m) => (
        <li key={m.month}>
          <span className="ad-rev-amount">{m.amount_lkr ? num(m.amount_lkr) : "—"}</span>
          <span className="ad-rev-track"><span style={{ height: `${(100 * m.amount_lkr) / most}%` }} /></span>
          <span className="ad-rev-month">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-LK", { month: "short" })}</span>
        </li>
      ))}
    </ul>
  );
}

const ATTENTION_ICON: Record<AttentionItem["kind"], ReactNode> = {
  feedback: icons.chat, drafts: icons.layers, quiz_job: icons.layers, kb_upload: icons.database,
  plans_ending: icons.crown, ai_failures: icons.cpu,
};
const PURPOSE: Record<string, string> = {
  tutor: "AI tutor", quiz: "Practice quizzes", ocr: "OCR (scanned papers)", feedback_review: "Feedback reviews", other: "Other",
};
const ago = (iso: string | null) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short" });
};
/** Tokens as 1.2k / 3.4M, so big numbers stay readable on a small card. */
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <div className="ad-att-clear">
        <span aria-hidden="true">{icons.check}</span>
        <p><strong>All clear.</strong> No student reports, drafts, failed jobs, plans about to end or AI errors right now.</p>
      </div>
    );
  }
  return (
    <ul className="ad-att">
      {items.map((it) => {
        const body = (
          <>
            <span className={`ad-att-icon ${it.severity}`} aria-hidden="true">{ATTENTION_ICON[it.kind]}</span>
            <span className="ad-att-copy">
              <strong>{it.title}</strong>
              <small>{it.detail}</small>
            </span>
            <span className="ad-att-meta">
              {it.at && <small>{ago(it.at)}</small>}
              {it.link && icons.chevronRight}
            </span>
          </>
        );
        return (
          <li key={it.kind}>
            {it.link ? <Link to={it.link} className="ad-att-row">{body}</Link> : <div className="ad-att-row">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function AiUsage({ u }: { u: AiUsageSummary }) {
  if (!u.month.calls) {
    return (
      <p className="ad-muted ad-pad">
        No AI calls recorded this month yet. Every tutor reply, quiz question, OCR page and feedback review is counted from now on.
      </p>
    );
  }
  const most = Math.max(1, ...u.by_purpose.map((p) => p.calls));
  const cost = (t: AiUsageSummary["today"]) => (t.priced_calls ? `$${t.cost_usd.toFixed(t.cost_usd < 1 ? 4 : 2)}` : "cost not reported");
  const tiles: [string, AiUsageSummary["today"]][] = [["Today", u.today], ["This month", u.month]];
  return (
    <div className="ad-ai">
      <div className="ad-ai-tiles">
        {tiles.map(([label, t]) => (
          <div key={label} className="ad-ai-tile">
            <small>{label}</small>
            <strong>{num(t.calls)} <span>calls</span></strong>
            <span className="ad-muted">{short(t.tokens)} tokens · {cost(t)}</span>
            {t.failed > 0 && <span className="ad-ai-failed">{num(t.failed)} failed</span>}
          </div>
        ))}
      </div>
      <ul className="ad-ai-bars" aria-label="Calls this month by feature">
        {u.by_purpose.map((p) => (
          <li key={p.purpose}>
            <span>{PURPOSE[p.purpose] ?? p.purpose}</span>
            <span className="ad-ai-track"><i style={{ width: `${(100 * p.calls) / most}%` }} /></span>
            <span className="ad-num">{num(p.calls)}</span>
          </li>
        ))}
      </ul>
      {u.top_models.length > 0 && (
        <p className="ad-ai-models ad-muted">Models: {u.top_models.map((m) => `${m.model} (${num(m.calls)})`).join(" · ")}</p>
      )}
      <p className="ad-ai-note ad-muted">
        Cost counts only what OpenRouter reported ({num(u.month.priced_calls)} of {num(u.month.calls)} calls this month).
        {u.last_call_at ? ` Last call ${ago(u.last_call_at)}.` : ""}
      </p>
    </div>
  );
}

/** A card whose data the platform does not record yet: says so, and what would fill it. */
function NotTracked({ text }: { text: string }) {
  return (
    <div className="ad-untracked">
      <span className="ad-untracked-tag">Not tracked yet</span>
      <p>{text}</p>
    </div>
  );
}

export function AdminOverview() {
  const navigate = useNavigate();
  const [days, setDays] = useState<OverviewDays>(30);
  const [medium, setMedium] = useState<MediumFilter>("all");
  const [data, setData] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminApi.overview(days, medium).then((d) => {
      if (!live) return;
      setData(d);
      setError(false);
    }, (err) => {
      if (!live) return;
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else if (err instanceof ApiError && err.status === 403) navigate("/dashboard", { replace: true });
      else setError(true);
    }).finally(() => live && setLoading(false));
    return () => { live = false; };            // a slower, older request must not overwrite a newer one
  }, [days, medium, navigate]);

  const k = data?.kpis;
  return (
    <main className="db-content ad-page">
      <header className="ad-head">
        <div>
          <h1>Overview</h1>
          <p>Key metrics and platform activity at a glance.</p>
        </div>
        {/* One filter row scopes every number on the page, so they always agree. */}
        <div className="ad-filters" role="group" aria-label="Filters">
          <label className="ad-select">
            {icons.calendar}
            <select value={days} onChange={(e) => setDays(Number(e.target.value) as OverviewDays)} aria-label="Date range">
              {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
            </select>
            {icons.chevronDown}
          </label>
          <label className="ad-select">
            {icons.globe}
            <select value={medium} onChange={(e) => setMedium(e.target.value as MediumFilter)} aria-label="Study medium">
              {MEDIUMS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {icons.chevronDown}
          </label>
        </div>
      </header>

      {error && !data && (
        <section className="ad-card ad-error" role="alert">
          Couldn't load the overview. Check that the backend is running, then reload.
        </section>
      )}

      {/* While a new range loads, the old numbers stay, faded (no skeleton, no layout jump). */}
      <div className={`ad-body${loading && data ? " ad-stale" : ""}`} aria-busy={loading}>
        <div className="ad-kpis">
          <Kpi icon={icons.users} tone="plum" label="Total students" kpi={k?.total_students ?? null} days={days}
            link={{ to: "/admin/students", label: "View students" }} />
          <Kpi icon={icons.userPlus} tone="plum" label="New signups" kpi={k?.new_signups ?? null} days={days}
            link={{ to: "/admin/students", label: "View students" }} />
          <Kpi icon={icons.clock} tone="amber" label="Active trials" kpi={k?.active_trials ?? null} days={days}
            link={{ to: "/admin/payments", label: "View subscriptions" }} />
          <Kpi icon={icons.crown} tone="amber" label="Paid subscribers" kpi={k?.paid_subscribers ?? null} days={days}
            link={{ to: "/admin/payments", label: "View subscriptions" }} />
          <Kpi icon={icons.coins} tone="coral" label="Revenue (LKR)" kpi={k?.revenue_lkr ?? null} days={days}
            link={{ to: "/admin/payments", label: "View payments" }} />
          <Kpi icon={icons.trendUp} tone="plum" label="Trial to paid" kpi={k?.trial_to_paid_pct ?? null} suffix="%" days={days}
            link={{ to: "/admin/payments", label: "View subscriptions" }} />
        </div>

        <div className="ad-row">
          <Card icon={icons.users} tone="plum" title="Signups per day" sub="New student registrations in the selected range.">
            {data ? <SignupsChart data={data.signups_per_day} /> : <div className="ad-chart-placeholder" />}
          </Card>
          <Card icon={icons.coins} tone="coral" title="Revenue per month" sub="Payments recorded by admins, last six months.">
            <RevenueBars months={data?.revenue_per_month ?? []} />
          </Card>
        </div>

        <div className="ad-row ad-row-wide">
          <Card icon={icons.bars} tone="amber" title="Learning health" sub="How students are learning on the platform.">
            <NotTracked text="Practice and tutor progress is kept in each student's browser, so the server can't count active students, daily goals or diagnostics yet." />
          </Card>
          <Card icon={icons.book} tone="plum" title="Weakest topics" sub="Platform-wide.">
            <NotTracked text="Needs practice results saved on the server (a practice_attempts table)." />
          </Card>
        </div>

        <div className="ad-row">
          <Card icon={icons.alert} tone="coral" title="Needs attention" sub="Items that require admin action, newest first."
            action={data && data.attention.length > 0 ? <span className="ad-att-count">{data.attention.length}</span> : undefined}>
            {data ? <NeedsAttention items={data.attention} /> : <div className="ad-chart-placeholder" />}
          </Card>
          <Card icon={icons.cpu} tone="plum" title="AI usage" sub="AI and OCR usage, to keep an eye on cost (Sri Lanka time).">
            {data ? <AiUsage u={data.ai_usage} /> : <div className="ad-chart-placeholder" />}
          </Card>
        </div>

        <div className="ad-row ad-row-wide">
          <Card icon={icons.users} tone="plum" title="Latest student signups"
            action={<Link to="/admin/students" className="ad-link">View all {icons.arrowRight}</Link>}>
            {data && data.latest_signups.length === 0 ? <p className="ad-muted ad-pad">No students yet.</p> : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Medium</th><th scope="col">Joined</th><th scope="col">Status</th></tr>
                  </thead>
                  <tbody>
                    {data?.latest_signups.map((s) => (
                      <tr key={s.id}>
                        <td>{s.full_name}</td>
                        <td className="ad-email">{s.email}</td>
                        <td>{s.medium === "ta" ? "Tamil" : s.medium === "en" ? "English" : "—"}</td>
                        <td className="ad-nowrap">{when(s.joined_at)}</td>
                        <td><span className={`ad-pill ${s.status}`}>{STATUS[s.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card icon={icons.card} tone="coral" title="Latest payments"
            action={<Link to="/admin/payments?tab=payments" className="ad-link">View all {icons.arrowRight}</Link>}>
            {!data?.latest_payments.length ? <p className="ad-muted ad-pad">No payments recorded yet.</p> : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead><tr><th scope="col">Student</th><th scope="col">Plan</th><th scope="col" className="ad-num">Amount</th><th scope="col">Paid</th></tr></thead>
                  <tbody>
                    {data.latest_payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.full_name}</td>
                        <td>{PLAN_LABEL[p.plan] ?? p.plan}</td>
                        <td className="ad-num">LKR {num(p.amount_lkr)}</td>
                        <td className="ad-nowrap">{when(p.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

export function AdminComingSoon() {
  return (
    <main className="db-content ad-page">
      <section className="ad-card ad-soon">
        <h1>Coming soon</h1>
        <p>This admin section isn't built yet. The Overview has the numbers available today.</p>
        <Link to="/admin" className="ad-link">Back to overview {icons.arrowRight}</Link>
      </section>
    </main>
  );
}
