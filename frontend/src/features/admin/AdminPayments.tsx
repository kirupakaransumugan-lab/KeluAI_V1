import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { icons } from "../dashboard/icons";
import {
  ApiError, adminApi, type BillingOverview, type BillingPayment, type BillingRow, type NewPayment, type PaidPlanKey, type PaymentMethod, type TrialLength, trialEndAfter,
} from "../../services/api";
import "../../styles/admin-students.css";
import "../../styles/admin-billing.css";
import { BILLING_LABEL } from "./AdminPlans";

// Admin > Subscriptions & Payments. Online payment isn't connected, so payments are recorded
// here by hand (bank transfer, cash...). Recording one starts the paid plan it bought; removing
// it undoes both. Admins can also give a student more trial days or end a plan now.

type Filter = "all" | "paid" | "trial" | "expiring" | "ended";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "paid", label: "Paid" }, { key: "trial", label: "In trial" },
  { key: "expiring", label: "Ending soon" }, { key: "ended", label: "Ended" },
];
const STATE_LABEL: Record<BillingRow["state"], string> = { trial: "Free trial", paid: "Paid", expired: "Trial ended", cancelled: "Cancelled" };
const PLAN_NAME: Record<string, string> = {
  trial: "Free trial", free: "Free", monthly: "Monthly", until_exam: "Until exam", class: "Class plan",
  annual: "Annual",       // older payments, before the price list changed
};
const METHOD: Record<PaymentMethod, string> = { bank_transfer: "Bank transfer", cash: "Cash", card: "Card", other: "Other" };
const TRIAL_OPTIONS: { label: string; length: TrialLength }[] = [
  { label: "7 days", length: { days: 7 } }, { label: "14 days", length: { days: 14 } }, { label: "1 month", length: { months: 1 } },
];

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : "—";
/** Today in Sri Lanka as yyyy-mm-dd, for the date field. */
const todayLk = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function Tile({ icon, tone, label, value, sub }: { icon: ReactNode; tone: string; label: string; value: string; sub?: string }) {
  return (
    <article className="ad-kpi">
      <div className="ad-kpi-top">
        <span className={`ad-badge ${tone}`}>{icon}</span>
        <div>
          <h3>{label}</h3>
          <strong className="ad-kpi-value">{value}</strong>
        </div>
      </div>
      {sub && <p className="ad-kpi-change ad-muted">{sub}</p>}
    </article>
  );
}

function Modal({ title, icon, tone = "plum", onClose, children }: {
  title: string; icon: ReactNode; tone?: "plum" | "red"; onClose: () => void; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ad-st-modal-scrim" onMouseDown={onClose}>
      <div className="ad-st-modal ad-bl-modal" role="dialog" aria-modal="true" aria-labelledby="ad-bl-modal-title"
        onMouseDown={(e) => e.stopPropagation()}>
        <span className={`ad-st-modal-icon ad-bl-icon-${tone}`}>{icon}</span>
        <h2 id="ad-bl-modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function RecordPayment({ data, preset, onClose, onSaved }: {
  data: BillingOverview; preset: number | null; onClose: () => void; onSaved: () => void;
}) {
  const price = (plan: string) => data.plans.find((p) => p.key === plan)?.price_lkr ?? 0;
  const [studentId, setStudentId] = useState<number | null>(preset);
  const [find, setFind] = useState("");
  const [plan, setPlan] = useState<PaidPlanKey>(data.plans[0]?.key as PaidPlanKey ?? "monthly");
  const [amount, setAmount] = useState(String(data.plans[0]?.price_lkr ?? ""));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayLk());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const findRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!preset) findRef.current?.focus(); }, [preset]);

  const student = data.subscriptions.find((s) => s.user_id === studentId);
  const matches = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return [];
    return data.subscriptions.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)).slice(0, 6);
  }, [find, data.subscriptions]);

  const choosePlan = (p: PaidPlanKey) => {
    // Keep a typed discount, but follow the price list when the amount is still a list price.
    if (data.plans.some((x) => String(x.price_lkr) === amount)) setAmount(String(price(p)));
    setPlan(p);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!studentId) return setError("Choose the student who paid.");
    if (!Number.isInteger(value) || value <= 0) return setError("Enter the amount paid, in whole rupees.");
    setBusy(true);
    setError(undefined);
    const body: NewPayment = { user_id: studentId, plan, amount_lkr: value, method,
      reference: reference.trim() || undefined, note: note.trim() || undefined,
      paid_at: paidOn ? `${paidOn}T12:00:00+05:30` : undefined };
    try {
      await adminApi.recordPayment(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "That student no longer exists." : "That didn't save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Record a payment" icon={icons.coins} onClose={onClose}>
      <p>For money received outside the app (bank transfer, cash…). Saving starts the paid plan straight away;
        if the student already has one running, the new one starts when it ends.</p>
      <form className="ad-bl-form" onSubmit={submit} noValidate>
        <div className="ad-bl-field">
          <span className="ad-bl-label">Student</span>
          {student ? (
            <div className="ad-bl-chosen">
              <span><strong>{student.full_name}</strong><small>{student.email}</small></span>
              <button type="button" className="ad-link ad-st-linkbtn" onClick={() => { setStudentId(null); setFind(""); }}>Change</button>
            </div>
          ) : (
            <div className="ad-bl-find">
              <input ref={findRef} type="search" value={find} onChange={(e) => setFind(e.target.value)}
                placeholder="Type a name or email" aria-label="Find student" />
              {matches.length > 0 && (
                <ul role="listbox" aria-label="Matching students">
                  {matches.map((s) => (
                    <li key={s.user_id}>
                      <button type="button" role="option" aria-selected="false" onClick={() => setStudentId(s.user_id)}>
                        <strong>{s.full_name}</strong><small>{s.email}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {find.trim() && !matches.length && <small className="ad-muted">No student matches.</small>}
            </div>
          )}
        </div>

        <div className="ad-bl-field">
          <span className="ad-bl-label">Plan</span>
          <div className="ad-bl-plans" role="radiogroup" aria-label="Plan">
            {data.plans.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={plan === p.key}
                className={plan === p.key ? "active" : ""} onClick={() => choosePlan(p.key as PaidPlanKey)}>
                <strong>{p.name_en}{p.is_visible ? "" : " (hidden)"}</strong><small>{lkr(p.price_lkr)} · {BILLING_LABEL[p.billing]}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="ad-bl-two">
          <label className="ad-bl-field">
            <span className="ad-bl-label">Amount paid (LKR)</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Paid on</span>
            <input type="date" value={paidOn} max={todayLk()} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {data.methods.map((m) => <option key={m} value={m}>{METHOD[m]}</option>)}
            </select>
          </label>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Reference <small>(optional)</small></span>
            <input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Slip or receipt no." />
          </label>
        </div>
        <label className="ad-bl-field">
          <span className="ad-bl-label">Note <small>(optional)</small></span>
          <input value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid by parent" />
        </label>

        {error && <p className="ad-bank-warn" role="alert">{error}</p>}
        <div className="ad-st-modal-foot">
          <button type="button" className="db-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="ad-st-btn danger" disabled={busy}>{busy ? "Saving…" : "Save payment"}</button>
        </div>
      </form>
    </Modal>
  );
}

type Pending =
  | { kind: "record"; userId: number | null }
  | { kind: "trial"; row: BillingRow }
  | { kind: "cancel"; row: BillingRow }
  | { kind: "remove"; payment: BillingPayment };

function RowActions({ row, onPick }: { row: BillingRow; onPick: (p: Pending) => void }) {
  // The menu is position: fixed under the button, so the table's scroll box can't clip it.
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const open = at !== null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAt(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    const away = () => setAt(null);              // a fixed menu would drift from its row on scroll
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);
  const toggle = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (open) return setAt(null);
    const r = e.currentTarget.getBoundingClientRect();
    setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };
  const live = row.state === "paid" || row.state === "trial";
  const pick = (p: Pending) => { setAt(null); onPick(p); };
  return (
    <div className="ad-bl-actions" ref={ref}>
      <button type="button" className="ad-bl-dots" aria-label={`Actions for ${row.full_name}`} aria-haspopup="menu"
        aria-expanded={open} onClick={toggle}>{icons.dots}</button>
      {at && (
        <div className="db-account-menu ad-st-more-menu ad-bl-menu" role="menu" style={{ top: at.top, right: at.right }}>
          <button role="menuitem" type="button" onClick={() => pick({ kind: "record", userId: row.user_id })}>{icons.coins}Record payment</button>
          <button role="menuitem" type="button" onClick={() => pick({ kind: "trial", row })}>{icons.clock}Give trial days</button>
          {live && row.current && (
            <button role="menuitem" type="button" className="ad-bl-danger" onClick={() => pick({ kind: "cancel", row })}>{icons.cross}End plan now</button>
          )}
          <Link role="menuitem" to={`/admin/students/${row.user_id}`}>{icons.users}Open student</Link>
        </div>
      )}
    </div>
  );
}

function Confirm({ pending, onClose, onDone }: { pending: Exclude<Pending, { kind: "record" }>; onClose: () => void; onDone: () => void }) {
  const [option, setOption] = useState(TRIAL_OPTIONS.length - 1);      // 1 month
  const length = TRIAL_OPTIONS[option];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (pending.kind === "trial") await adminApi.extendTrial(pending.row.user_id, length.length);
      else if (pending.kind === "cancel" && pending.row.current) await adminApi.cancelSubscription(pending.row.current.id);
      else if (pending.kind === "remove") await adminApi.removePayment(pending.payment.id);
      onDone();
    } catch {
      setError("That didn't save. Please try again.");
      setBusy(false);
    }
  };

  if (pending.kind === "trial") {
    const cur = pending.row.current;
    const running = pending.row.state === "trial";
    return (
      <Modal title={`Give ${pending.row.full_name.split(" ")[0]} more trial days`} icon={icons.clock} onClose={onClose}>
        <p>{running && cur ? `The trial now ends on ${date(cur.ends_at)}; the days are added after that.`
          : "Their trial has ended, so a new one starts today."}</p>
        <div className="ad-bl-days" role="radiogroup" aria-label="Extra trial time">
          {TRIAL_OPTIONS.map((o, i) => (
            <button key={o.label} type="button" role="radio" aria-checked={option === i} className={option === i ? "active" : ""}
              onClick={() => setOption(i)}>{o.label}</button>
          ))}
        </div>
        <p className="ad-muted">New trial end: <strong>{date(trialEndAfter(running && cur ? cur.ends_at : null, length.length).toISOString())}</strong></p>
        {error && <p className="ad-bank-warn" role="alert">{error}</p>}
        <div className="ad-st-modal-foot">
          <button type="button" className="db-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="ad-st-btn danger" disabled={busy} onClick={run}>{busy ? "Saving…" : `Add ${length.label}`}</button>
        </div>
      </Modal>
    );
  }
  const removing = pending.kind === "remove";
  return (
    <Modal tone="red" icon={icons.alert} onClose={onClose}
      title={removing ? "Remove this payment?" : `End ${pending.row.full_name.split(" ")[0]}'s plan now?`}>
      <p>{removing
        ? `${lkr(pending.payment.amount_lkr)} from ${pending.payment.student} on ${date(pending.payment.paid_at)}. The ${PLAN_NAME[pending.payment.plan].toLowerCase()} plan it started is removed too. Use this only for a payment recorded by mistake.`
        : `Their ${PLAN_NAME[pending.row.current?.plan ?? ""]?.toLowerCase() ?? ""} plan stops today and stays in their history as cancelled. Any money is not refunded automatically.`}</p>
      {error && <p className="ad-bank-warn" role="alert">{error}</p>}
      <div className="ad-st-modal-foot">
        <button type="button" className="db-btn-outline" onClick={onClose}>Keep it</button>
        <button type="button" className="ad-st-btn danger" disabled={busy} onClick={run}>
          {busy ? "Saving…" : removing ? "Remove payment" : "End plan"}
        </button>
      </div>
    </Modal>
  );
}

export function AdminPayments() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<BillingOverview>();
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"subscriptions" | "payments">(params.get("tab") === "payments" ? "payments" : "subscriptions");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<string>();

  const load = useCallback(() => {
    adminApi.billing().then((d) => { setData(d); setFailed(false); }, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setFailed(true);
    });
  }, [navigate]);
  useEffect(load, [load]);

  // /admin/payments?record=<student id> (from a student's page) opens the form for them.
  useEffect(() => {
    const id = Number(params.get("record"));
    if (data && id) {
      setPending({ kind: "record", userId: id });
      setParams((p) => { p.delete("record"); return p; }, { replace: true });
    }
  }, [data, params, setParams]);

  const done = (message: string) => {
    setPending(null);
    setToast(message);
    window.setTimeout(() => setToast(undefined), 3000);
    load();
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const soon = Date.now() + data.expiring_days * 86_400_000;
    return data.subscriptions.filter((r) => {
      if (needle && !r.full_name.toLowerCase().includes(needle) && !r.email.toLowerCase().includes(needle)) return false;
      switch (filter) {
        case "paid": return r.state === "paid";
        case "trial": return r.state === "trial";
        case "expiring": return (r.state === "paid" || r.state === "trial") && !!r.current && new Date(r.current.ends_at).getTime() <= soon;
        case "ended": return r.state === "expired" || r.state === "cancelled";
        default: return true;
      }
    });
  }, [data, q, filter]);

  const payments = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.payments ?? []).filter((p) => !needle || p.student.toLowerCase().includes(needle)
      || (p.email ?? "").toLowerCase().includes(needle) || (p.reference ?? "").toLowerCase().includes(needle));
  }, [data, q]);

  const k = data?.kpis;
  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Subscriptions &amp; Payments</h1>
          <p>Every student's plan, and the payments recorded for them.</p>
        </div>
        <button type="button" className="ad-st-btn danger ad-bl-record" disabled={!data}
          onClick={() => setPending({ kind: "record", userId: null })}>
          {icons.plus}Record payment
        </button>
      </div>

      <p className="ad-bl-banner">{icons.alert}
        <span>Online payment isn't connected yet. When a student pays by bank transfer or cash, record it here and their paid plan starts at once.</span>
      </p>

      {failed ? (
        <section className="ad-card" role="alert">
          <p className="ad-pad ad-muted">Couldn't load subscriptions.</p>
          <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
        </section>
      ) : !data || !k ? (
        <section className="ad-card" role="status"><p className="ad-pad ad-muted">Loading…</p></section>
      ) : (
        <>
          <div className="ad-kpis">
            <Tile icon={icons.crown} tone="amber" label="Paid subscribers" value={String(k.paid)} />
            <Tile icon={icons.clock} tone="plum" label="In free trial" value={String(k.trials)} />
            <Tile icon={icons.alert} tone="coral" label="Ending soon" value={String(k.expiring)} sub={`Within ${data.expiring_days} days`} />
            <Tile icon={icons.cross} tone="plum" label="Ended" value={String(k.ended)} sub="Trial ended or cancelled" />
            <Tile icon={icons.coins} tone="coral" label="Revenue" value={lkr(k.revenue_30d)} sub={`Last ${data.revenue_days} days`} />
            <Tile icon={icons.trendUp} tone="amber" label="All-time revenue" value={lkr(k.revenue_total)} />
          </div>

          <section className="ad-card">
            <div className="ad-bl-bar">
              <div className="ad-bl-tabs" role="tablist" aria-label="Section">
                <button type="button" role="tab" aria-selected={tab === "subscriptions"} className={tab === "subscriptions" ? "active" : ""}
                  onClick={() => setTab("subscriptions")}>{icons.users}Subscriptions <span>{data.subscriptions.length}</span></button>
                <button type="button" role="tab" aria-selected={tab === "payments"} className={tab === "payments" ? "active" : ""}
                  onClick={() => setTab("payments")}>{icons.coins}Payments <span>{data.payments.length}</span></button>
              </div>
              <label className="ad-select ad-st-search">
                {icons.search}
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={tab === "payments" ? "Search student or reference" : "Search name or email"} aria-label="Search" />
              </label>
            </div>

            {tab === "subscriptions" ? (
              <>
                <div className="ad-bl-chips" role="group" aria-label="Filter">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" aria-pressed={filter === f.key} className={filter === f.key ? "active" : ""}
                      onClick={() => setFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
                {rows.length ? (
                  <div className="ad-table-wrap">
                    <table className="ad-table">
                      <thead>
                        <tr><th>Student</th><th>Status</th><th>Plan</th><th>Started</th><th>Ends</th><th className="ad-num">Days left</th><th>Account</th><th><span className="ad-st-sr">Actions</span></th></tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.user_id}>
                            <td>
                              <Link to={`/admin/students/${r.user_id}`} className="ad-st-who">
                                <span className="ad-st-avatar" aria-hidden="true">{r.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}</span>
                                <span><strong>{r.full_name}</strong><small>{r.email}</small></span>
                              </Link>
                            </td>
                            <td><span className={`ad-pill ${r.state}`}>{STATE_LABEL[r.state]}</span></td>
                            <td>{r.current ? PLAN_NAME[r.current.plan] ?? r.current.plan : "—"}</td>
                            <td>{date(r.current?.starts_at)}</td>
                            <td>{date(r.current?.ends_at)}</td>
                            <td className="ad-num">{r.current && r.current.days_left ? r.current.days_left : "—"}</td>
                            <td>{r.is_active ? <span className="ad-muted">On</span> : <span className="ad-st-status off">{icons.cross}Off</span>}</td>
                            <td><RowActions row={r} onPick={setPending} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="ad-st-empty">{data.subscriptions.length ? "No students match." : "No students yet."}</p>}
              </>
            ) : payments.length ? (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr><th>Paid on</th><th>Student</th><th>Plan</th><th className="ad-num">Amount</th><th>Method</th><th>Reference</th><th>Recorded by</th><th><span className="ad-st-sr">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{date(p.paid_at)}</td>
                        <td><Link to={`/admin/students/${p.user_id}`} className="ad-bl-name">{p.student}</Link>
                          {p.note && <small className="ad-bl-note" title={p.note}>{p.note}</small>}</td>
                        <td>{PLAN_NAME[p.plan]}</td>
                        <td className="ad-num"><strong>{lkr(p.amount_lkr)}</strong></td>
                        <td>{METHOD[p.method] ?? p.method}</td>
                        <td className="ad-muted">{p.reference ?? "—"}</td>
                        <td className="ad-muted">{p.recorded_by ?? "—"}</td>
                        <td>
                          <button type="button" className="ad-bl-remove" aria-label={`Remove payment from ${p.student}`}
                            onClick={() => setPending({ kind: "remove", payment: p })}>{icons.trash}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="ad-st-empty">{data.payments.length ? "No payments match." : "No payments recorded yet. Use “Record payment” when a student pays."}</p>}
          </section>
        </>
      )}

      {data && pending?.kind === "record" && (
        <RecordPayment data={data} preset={pending.userId} onClose={() => setPending(null)}
          onSaved={() => { setTab("payments"); done("Payment saved. The paid plan has started."); }} />
      )}
      {pending && pending.kind !== "record" && (
        <Confirm pending={pending} onClose={() => setPending(null)}
          onDone={() => done(pending.kind === "trial" ? "Trial days added." : pending.kind === "cancel" ? "Plan ended." : "Payment removed.")} />
      )}
      {toast && <div className="ad-bl-toast" role="status">{icons.check}{toast}</div>}
    </main>
  );
}
