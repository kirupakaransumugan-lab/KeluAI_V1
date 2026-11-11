import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { icons } from "../dashboard/icons";
import {
  ApiError, adminApi, trialEndAfter, type AdminStudentDetail as Detail, type AdminStudentRow, type MediumFilter,
} from "../../services/api";
import "../../styles/admin-students.css";

// Admin > Students: a searchable list, and one student's page (Overview, Progress,
// Subscription, Activity). Every figure comes from GET /admin/students[/{id}], which uses the
// same rules as the student's own Progress page. Nothing here is invented: a student who
// hasn't practised yet sees "No practice yet", not a 0% that looks like a score.

const PLAN_LABEL: Record<AdminStudentRow["plan_state"], string> = {
  trial: "Free trial", paid: "Paid", expired: "Trial ended", cancelled: "Cancelled",
};
const PLAN_NAME: Record<string, string> = {
  trial: "Free trial", free: "Free", monthly: "Monthly", until_exam: "Until exam", class: "Class plan",
  annual: "Annual",       // older payments, before the price list changed
};
const SUB_STATUS: Record<string, string> = { trialing: "In trial", active: "Active", expired: "Ended", cancelled: "Cancelled" };
const MEDIUM: Record<string, string> = { en: "English", ta: "Tamil" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_LABEL = ["This week", "Last week", "2 weeks ago"];
const GOOD_TOPIC = 75;          // a topic at or above this shows as a green bar

const studentId = (id: number) => `STU${String(id).padStart(4, "0")}`;
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** "3 days ago", or the date once it's more than a month back. */
function ago(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return days < 31 ? `${days} days ago` : date(iso);
}

function Avatar({ name, big = false }: { name: string; big?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
  return <span className={`ad-st-avatar${big ? " big" : ""}`} aria-hidden="true">{initials || "?"}</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`ad-st-status ${active ? "on" : "off"}`}>
      {active ? icons.check : icons.cross}{active ? "Active" : "Switched off"}
    </span>
  );
}

// ---------------------------------------------------------------- list

export function AdminStudents() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [medium, setMedium] = useState<MediumFilter>("all");
  const [data, setData] = useState<{ students: AdminStudentRow[]; limit: number }>();
  const [failed, setFailed] = useState(false);

  // Search as the admin types, a moment after they stop.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    setFailed(false);
    adminApi.students(query, medium).then(setData, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setFailed(true);
    });
  }, [query, medium, navigate]);
  useEffect(load, [load]);

  const rows = data?.students;
  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Students</h1>
          <p>Everyone who signed up, newest first. Open a student to see their progress and plan.</p>
        </div>
        <div className="ad-filters ad-st-filters">
          <label className="ad-select ad-st-search">
            {icons.search}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or mobile" aria-label="Search students" />
          </label>
          <label className="ad-select">
            {icons.globe}
            <select value={medium} onChange={(e) => setMedium(e.target.value as MediumFilter)} aria-label="Medium">
              <option value="all">All mediums</option>
              <option value="en">English medium</option>
              <option value="ta">Tamil medium</option>
            </select>
            {icons.chevronDown}
          </label>
        </div>
      </div>

      <section className="ad-card">
        {failed ? (
          <div role="alert">
            <p className="ad-pad ad-muted">Couldn't load the students.</p>
            <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
          </div>
        ) : !rows ? (
          <p className="ad-pad ad-muted" role="status">Loading…</p>
        ) : !rows.length ? (
          <p className="ad-pad ad-muted">{query || medium !== "all" ? "No students match." : "No students yet."}</p>
        ) : (
          <>
            <p className="ad-st-count">
              {rows.length === data.limit ? `Showing the newest ${rows.length}. Search to find others.` : `${rows.length} student${rows.length === 1 ? "" : "s"}`}
            </p>
            <div className="ad-table-wrap">
              <table className="ad-table ad-st-table">
                <thead>
                  <tr>
                    <th>Student</th><th>ID</th><th>Medium</th><th>A/L year</th><th>Plan</th>
                    <th>Account</th><th className="ad-num">Questions</th><th>Last active</th><th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => navigate(`/admin/students/${s.id}`)}>
                      <td>
                        <Link to={`/admin/students/${s.id}`} className="ad-st-who" onClick={(e) => e.stopPropagation()}>
                          <Avatar name={s.full_name} />
                          <span><strong>{s.full_name}</strong><small>{s.email}</small></span>
                        </Link>
                      </td>
                      <td className="ad-muted">{studentId(s.id)}</td>
                      <td>{s.medium ? MEDIUM[s.medium] : "—"}</td>
                      <td>{s.al_exam_year ?? "—"}</td>
                      <td><span className={`ad-pill ${s.plan_state}`}>{PLAN_LABEL[s.plan_state]}</span></td>
                      <td><StatusPill active={s.is_active} /></td>
                      <td className="ad-num">{s.questions.toLocaleString("en-LK")}</td>
                      <td>{ago(s.last_active_at)}</td>
                      <td>{date(s.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------- detail

type Tab = "overview" | "progress" | "subscription" | "activity";
const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: icons.chart },
  { key: "progress", label: "Progress", icon: icons.target },
  { key: "subscription", label: "Subscription", icon: icons.card },
  { key: "activity", label: "Activity", icon: icons.clock },
];

function Panel({ icon, title, action, className = "", children }: {
  icon: ReactNode; title: string; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={`ad-card ad-st-panel ${className}`}>
      <header className="ad-st-panel-head">
        <span className="ad-st-panel-icon">{icon}</span>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Donut({ value }: { value: number | null }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = value ?? 0;
  return (
    <div className="ad-st-donut" role="img" aria-label={value == null ? "No practice yet" : `Overall progress ${value}%`}>
      <svg viewBox="0 0 128 128">
        <defs>
          <linearGradient id="ad-st-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ad-st-ring-a)" />
            <stop offset="1" stopColor="var(--ad-st-ring-b)" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} className="ad-st-donut-track" />
        <circle cx="64" cy="64" r={r} className="ad-st-donut-fill" stroke="url(#ad-st-ring)"
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className="ad-st-donut-copy">
        <strong>{value == null ? "—" : `${value}%`}</strong>
        <span>Overall progress</span>
      </div>
    </div>
  );
}

function Stat({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: string }) {
  return (
    <div className="ad-st-stat">
      <span className={`ad-st-stat-icon ${tone}`}>{icon}</span>
      <span><small>{label}</small><strong>{value}</strong></span>
    </div>
  );
}

/** Mon..Sun cells, darker the more questions that day. */
function Heatmap({ weeks }: { weeks: Detail["activity"] }) {
  const most = Math.max(1, ...weeks.flatMap((w) => w.days.map((d) => d.questions)));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / most)));
  return (
    <div className="ad-st-heat" role="table" aria-label="Questions answered per day">
      <div role="row" className="ad-st-heat-row">
        <span role="columnheader" />
        {DAYS.map((d) => <span role="columnheader" key={d} className="ad-st-heat-day">{d}</span>)}
      </div>
      {weeks.map((w, i) => (
        <div role="row" className="ad-st-heat-row" key={w.start}>
          <span role="rowheader" className="ad-st-heat-label">{WEEK_LABEL[i] ?? w.start}</span>
          {w.days.map((d) => (
            <span role="cell" key={d.date} className={`ad-st-cell l${d.future ? "x" : level(d.questions)}`}
              title={d.future ? date(d.date) : `${date(d.date)}: ${d.questions} question${d.questions === 1 ? "" : "s"}`}>
              <span className="ad-st-sr">{d.future ? "" : d.questions}</span>
            </span>
          ))}
        </div>
      ))}
      <div className="ad-st-heat-key" aria-hidden="true">
        Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`ad-st-cell l${l}`} />)} More
      </div>
    </div>
  );
}

function TopicBars({ topics }: { topics: Detail["progress"]["topics"] }) {
  return (
    <ul className="ad-st-bars">
      {topics.map((t) => (
        <li key={t.key}>
          <span className="ad-st-bar-name">{t.name.en}</span>
          <span className="ad-st-bar-track">
            {t.pct != null && <span className={`ad-st-bar-fill${t.pct >= GOOD_TOPIC ? " good" : ""}`} style={{ width: `${t.pct}%` }} />}
          </span>
          <span className="ad-st-bar-pct">{t.pct == null ? "—" : `${t.pct}%`}</span>
        </li>
      ))}
    </ul>
  );
}

function Access({ d, busy, onSet }: { d: Detail; busy: boolean; onSet: (active: boolean) => void }) {
  const cur = d.subscription.current;
  return (
    <>
      <dl className="ad-st-facts">
        <div><dt>{icons.crown}Current plan</dt><dd>{cur ? PLAN_NAME[cur.plan] ?? cur.plan : "None"}</dd></div>
        <div><dt>{icons.calendar}{cur?.plan === "trial" ? "Trial period" : "Plan period"}</dt>
          <dd>{cur ? `${date(cur.starts_at)} – ${date(cur.ends_at)}` : "—"}</dd></div>
        <div><dt>{icons.clock}Days left</dt><dd>{cur && cur.days_left ? cur.days_left : "—"}</dd></div>
        <div><dt>{icons.users}Account</dt><dd><StatusPill active={d.student.is_active} /></dd></div>
      </dl>
      <div className="ad-st-access">
        <button type="button" className="ad-st-btn danger" disabled={busy || !d.student.is_active} onClick={() => onSet(false)}>
          {icons.stop}Deactivate user
        </button>
        <button type="button" className="ad-st-btn" disabled={busy || d.student.is_active} onClick={() => onSet(true)}>
          {icons.play}Activate user
        </button>
      </div>
    </>
  );
}

function ConfirmOff({ name, busy, onCancel, onConfirm }: {
  name: string; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="ad-st-modal-scrim" onClick={onCancel}>
      <div className="ad-st-modal" role="alertdialog" aria-modal="true" aria-labelledby="ad-st-off-title"
        onClick={(e) => e.stopPropagation()}>
        <span className="ad-st-modal-icon">{icons.alert}</span>
        <h2 id="ad-st-off-title">Switch off {name}'s account?</h2>
        <p>They are signed out everywhere straight away and can't log in until you activate the account again.
          Their chats, progress and plan are kept.</p>
        <div className="ad-st-modal-foot">
          <button type="button" className="db-btn-outline" ref={cancelRef} onClick={onCancel}>Cancel</button>
          <button type="button" className="ad-st-btn danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Switching off…" : "Deactivate user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoreMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the address is on screen anyway */ }
  };
  return (
    <div className="ad-st-more" ref={ref}>
      <button type="button" className="ad-st-more-btn" aria-label="More actions" aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}>{icons.dots}</button>
      {open && (
        <div className="db-account-menu ad-st-more-menu" role="menu">
          <a role="menuitem" href={`mailto:${email}`}>{icons.send}Email student</a>
          <button role="menuitem" type="button" onClick={copy}>{icons.doc}{copied ? "Copied" : "Copy email"}</button>
        </div>
      )}
    </div>
  );
}

function Overview({ d, busy, onSet, goTab }: { d: Detail; busy: boolean; onSet: (a: boolean) => void; goTab: (t: Tab) => void }) {
  const p = d.progress;
  const tried = p.topics.filter((t) => t.pct != null).sort((a, b) => b.questions - a.questions).slice(0, 5);
  return (
    <div className="ad-st-grid">
      <Panel icon={icons.chart} title="Learning Progress">
        {p.has_answers ? (
          <div className="ad-st-learning">
            <Donut value={p.mastery.value} />
            <div className="ad-st-stats">
              <Stat icon={icons.check} tone="green" label="Questions solved" value={p.accuracy.questions.toLocaleString("en-LK")} />
              <Stat icon={icons.target} tone="plum" label="Accuracy" value={p.accuracy.value == null ? "—" : `${p.accuracy.value}%`} />
              <Stat icon={icons.book} tone="amber" label="Topics completed"
                value={`${p.topics_covered.covered} / ${p.topics_covered.total}`} />
            </div>
          </div>
        ) : <p className="ad-st-empty">No practice yet. Figures appear after the first practice set or quiz.</p>}
      </Panel>

      <Panel icon={icons.calendar} title="Study Activity">
        <Heatmap weeks={d.activity} />
        <p className="ad-st-note">Streak: <strong>{p.streak.current}</strong> day{p.streak.current === 1 ? "" : "s"} · best {p.streak.best}</p>
      </Panel>

      <Panel icon={icons.trendUp} title="Topic Performance"
        action={<button type="button" className="ad-link ad-st-linkbtn" onClick={() => goTab("progress")}>View all topics {icons.arrowRight}</button>}>
        {tried.length ? <TopicBars topics={tried} /> : <p className="ad-st-empty">No topics practised yet.</p>}
      </Panel>

      <Panel icon={icons.crown} title="Subscription & Access">
        <Access d={d} busy={busy} onSet={onSet} />
      </Panel>
    </div>
  );
}

function ProgressTab({ d }: { d: Detail }) {
  const p = d.progress;
  const byStrand = (s: "pure" | "applied") => p.topics.filter((t) => t.strand === s);
  return (
    <div className="ad-st-stack">
      <Panel icon={icons.target} title="Every topic">
        <div className="ad-st-strands">
          {(["pure", "applied"] as const).map((s) => (
            <div key={s}>
              <h3 className="ad-st-strand">{s === "pure" ? "Pure mathematics" : "Applied mathematics"}</h3>
              <TopicBars topics={byStrand(s)} />
            </div>
          ))}
        </div>
        <p className="ad-st-note">Score = steps right ÷ steps tried, across every practice set and quiz. “—” means not tried yet.</p>
      </Panel>
      <Panel icon={icons.bars} title="Last five weeks">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr><th>Week of</th><th className="ad-num">Questions</th><th className="ad-num">Score</th><th className="ad-num">Accuracy</th><th className="ad-num">Active days</th></tr></thead>
            <tbody>
              {[...p.weekly].reverse().map((w) => (
                <tr key={w.start}>
                  <td>{date(w.start)}</td>
                  <td className="ad-num">{w.questions}</td>
                  <td className="ad-num">{w.score == null ? "—" : `${w.score}%`}</td>
                  <td className="ad-num">{w.accuracy == null ? "—" : `${w.accuracy}%`}</td>
                  <td className="ad-num">{w.active_days} / 7</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/** Gives the student one more calendar month of trial, added after a running trial or from today. */
function ExtendTrial({ d, onChanged }: { d: Detail; onChanged: (s: Detail["subscription"]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cur = d.subscription.current;
  if (cur && cur.plan !== "trial" && (cur.status === "active" || cur.status === "trialing")) return null;   // on a paid plan
  const running = cur?.plan === "trial" && cur.status === "trialing";
  const ends = trialEndAfter(running ? cur.ends_at : null, { months: 1 });
  const extend = async () => {
    setBusy(true);
    setError(false);
    try {
      onChanged(await adminApi.extendTrial(d.student.id, { months: 1 }));
    } catch {
      setError(true);
    }
    setBusy(false);
  };
  return (
    <div className="ad-st-extend">
      <button type="button" className="ad-st-btn" disabled={busy || !d.student.is_active} onClick={extend}>
        {icons.clock}{busy ? "Extending…" : running ? "Extend trial by 1 month" : "Start a 1-month trial"}
      </button>
      <small className="ad-muted">
        {d.student.is_active ? `Trial would end on ${date(ends.toISOString())}.` : "Activate the account first."}
      </small>
      {error && <small className="ad-st-extend-error" role="alert">That didn't save. Please try again.</small>}
    </div>
  );
}

function SubscriptionTab({ d, busy, onSet, onChanged }: {
  d: Detail; busy: boolean; onSet: (a: boolean) => void; onChanged: (s: Detail["subscription"]) => void;
}) {
  const { history, payments_enabled } = d.subscription;
  return (
    <div className="ad-st-grid">
      <Panel icon={icons.crown} title="Plan & access">
        <Access d={d} busy={busy} onSet={onSet} />
        <ExtendTrial d={d} onChanged={onChanged} />
      </Panel>
      <Panel icon={icons.history} title="Plan history">
        {history.length ? (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Plan</th><th>Status</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{PLAN_NAME[h.plan] ?? h.plan}</td>
                    <td>{SUB_STATUS[h.status] ?? h.status}</td>
                    <td>{date(h.starts_at)}</td>
                    <td>{date(h.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="ad-st-empty">No plans on record.</p>}
        {!payments_enabled && <p className="ad-st-note">Online payments aren't switched on yet, so a paid plan starts when an admin records a payment.</p>}
        <Link to={`/admin/payments?record=${d.student.id}`} className="ad-st-btn ad-bl-from-student">{icons.coins}Record payment</Link>
      </Panel>
    </div>
  );
}

function ActivityTab({ d }: { d: Detail }) {
  const s = d.student;
  return (
    <div className="ad-st-grid">
      <Panel icon={icons.history} title="Recent practice">
        {d.sessions.length ? (
          <ul className="ad-st-sessions">
            {d.sessions.map((x) => (
              <li key={x.set_id}>
                <span className="ad-st-session-icon">{icons.pencil}</span>
                <span className="ad-st-session-copy">
                  <strong>{x.topics.length === 1 ? x.topics[0] : x.topics.length ? `${x.topics.join(", ")}${x.topics.length === 3 ? "…" : ""}` : "Practice"}</strong>
                  <small>{dateTime(x.at)} · {x.lang === "ta" ? "Tamil" : "English"}</small>
                </span>
                <span className="ad-st-session-score">{x.perfect} / {x.questions}<small>fully right</small></span>
              </li>
            ))}
          </ul>
        ) : <p className="ad-st-empty">No practice yet.</p>}
      </Panel>
      <Panel icon={icons.users} title="Account details">
        <dl className="ad-st-facts">
          <div><dt>Mobile</dt><dd>{s.mobile}</dd></div>
          <div><dt>Parent email</dt><dd>{s.parent_email ?? "—"}</dd></div>
          <div><dt>Medium</dt><dd>{s.medium ? MEDIUM[s.medium] : "—"}</dd></div>
          <div><dt>A/L exam year</dt><dd>{s.al_exam_year ?? "—"}</dd></div>
          <div><dt>Signs in with</dt><dd>{[s.has_password && "Password", s.google && "Google", s.microsoft && "Microsoft"].filter(Boolean).join(" + ") || "—"}</dd></div>
          <div><dt>Last active</dt><dd>{ago(s.last_active_at)}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

export function AdminStudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<Detail>();
  const [state, setState] = useState<"loading" | "missing" | "failed" | "ready">("loading");
  const [tab, setTab] = useState<Tab>("overview");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    setState("loading");
    adminApi.student(Number(id)).then((r) => { setD(r); setState("ready"); }, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setState(err instanceof ApiError && err.status === 404 ? "missing" : "failed");
    });
  }, [id, navigate]);
  useEffect(load, [load]);

  const setActive = async (active: boolean) => {
    if (!d) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await adminApi.setStudentActive(d.student.id, active);
      setD({ ...d, student: { ...d.student, is_active: r.is_active } });
      setConfirming(false);
    } catch {
      setError("That didn't save. Please try again.");
    }
    setBusy(false);
  };
  const onSet = (active: boolean) => (active ? setActive(true) : setConfirming(true));
  const cancel = useCallback(() => setConfirming(false), []);

  const crumbs = (
    <nav className="ad-st-crumbs" aria-label="Breadcrumb">
      <Link to="/admin/students" className="ad-st-back" aria-label="Back to students">{icons.arrowLeft}</Link>
      <Link to="/admin/students">Students</Link>
      <span aria-hidden="true">/</span>
      <strong aria-current="page">Student Details</strong>
    </nav>
  );

  if (state !== "ready" || !d) {
    return (
      <main className="db-content ad-page">
        {crumbs}
        <section className="ad-card" role={state === "loading" ? "status" : "alert"}>
          <p className="ad-pad ad-muted">
            {state === "loading" ? "Loading…" : state === "missing" ? "There's no student with this ID." : "Couldn't load this student."}
          </p>
          {state === "failed" && <button type="button" className="db-btn-outline" onClick={load}>Try again</button>}
        </section>
      </main>
    );
  }

  const s = d.student;
  const cur = d.subscription.current;
  return (
    <main className="db-content ad-page ad-st-page">
      {crumbs}

      <section className="ad-card ad-st-hero">
        <Avatar name={s.full_name} big />
        <div className="ad-st-id">
          <h1>{s.full_name}</h1>
          <p>{s.email}</p>
          <p className="ad-st-id-row"><span>ID: {studentId(s.id)}</span><StatusPill active={s.is_active} /></p>
        </div>
        <div className="ad-st-tiles">
          <div className="ad-st-tile"><span className="plum">{icons.calendar}</span><span><small>Joined</small><strong>{date(s.joined_at)}</strong></span></div>
          <div className="ad-st-tile"><span className="amber">{icons.clock}</span>
            <span><small>{cur?.plan === "trial" ? "Trial ends" : "Plan ends"}</small><strong>{cur ? date(cur.ends_at) : "—"}</strong></span></div>
          <div className="ad-st-tile"><span className="gold">{icons.crown}</span>
            <span><small>Plan</small><strong>{PLAN_LABEL[s.plan_state]}</strong></span></div>
        </div>
        <MoreMenu email={s.email} />
      </section>

      <div className="ad-st-tabs" role="tablist" aria-label="Student sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`ad-st-tab-${t.key}`} aria-selected={tab === t.key}
            aria-controls="ad-st-tabpanel" className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {error && <p className="ad-bank-warn" role="alert">{error}</p>}
      <div id="ad-st-tabpanel" role="tabpanel" aria-labelledby={`ad-st-tab-${tab}`}>
        {tab === "overview" && <Overview d={d} busy={busy} onSet={onSet} goTab={setTab} />}
        {tab === "progress" && <ProgressTab d={d} />}
        {tab === "subscription" && (
          <SubscriptionTab d={d} busy={busy} onSet={onSet} onChanged={(subscription) => setD({ ...d, subscription })} />
        )}
        {tab === "activity" && <ActivityTab d={d} />}
      </div>

      {confirming && <ConfirmOff name={s.full_name.split(" ")[0]} busy={busy} onCancel={cancel} onConfirm={() => setActive(false)} />}
    </main>
  );
}
