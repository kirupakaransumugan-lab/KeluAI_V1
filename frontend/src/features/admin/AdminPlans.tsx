import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { icons } from "../dashboard/icons";
import { loadError } from "./loadError";
import { ApiError, adminApi, type AdminPlan, type PlanBilling, type PlanChanges, type PlanInfo } from "../../services/api";
import "../../styles/admin-students.css";
import "../../styles/admin-billing.css";
import "../../styles/admin-plans.css";

// Admin > Plans: the price list students see on their Subscription page, and how each plan is
// doing. Plan keys and how they bill are fixed in the backend (app/services/plans.py); names,
// prices, descriptions, visibility and the "best value" badge are edited here.

/** What the price is for, as shown under it. Exported for the payment form. */
export const BILLING_LABEL: Record<PlanBilling, string> = {
  free: "always", month: "per month", until_exam: "until the student's A/L", student_month: "per student a month",
};

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" }) : null;

function EditPlan({ plan, onClose, onSaved }: { plan: AdminPlan; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name_en: plan.name_en, name_ta: plan.name_ta, price: String(plan.price_lkr),
    blurb_en: plan.blurb_en, blurb_ta: plan.blurb_ta, is_visible: plan.is_visible, highlight: plan.highlight,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const free = plan.billing === "free";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.name_en.trim() || !form.name_ta.trim()) return setError("Give the plan a name in English and Tamil.");
    if (!free && (!Number.isInteger(price) || price <= 0)) return setError("Enter the price in whole rupees.");
    const changes: PlanChanges = {
      name_en: form.name_en, name_ta: form.name_ta, blurb_en: form.blurb_en, blurb_ta: form.blurb_ta,
      is_visible: form.is_visible, highlight: form.highlight, ...(free ? {} : { price_lkr: price }),
    };
    setBusy(true);
    setError(undefined);
    try {
      await adminApi.updatePlan(plan.key, changes);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? "Check the fields: a name is required and the free plan has no price."
        : "That didn't save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="ad-st-modal-scrim" onMouseDown={onClose}>
      <div className="ad-st-modal ad-bl-modal ad-pl-modal" role="dialog" aria-modal="true" aria-labelledby="ad-pl-edit-title"
        onMouseDown={(e) => e.stopPropagation()}>
        <span className="ad-st-modal-icon ad-bl-icon-plum">{icons.pencil}</span>
        <h2 id="ad-pl-edit-title">Edit {plan.name_en}</h2>
        <p>Changes show on students' Subscription page straight away. Plans already bought keep the price that was paid.</p>
        <form className="ad-bl-form" onSubmit={submit} noValidate>
          <div className="ad-bl-two">
            <label className="ad-bl-field">
              <span className="ad-bl-label">Name (English)</span>
              <input value={form.name_en} maxLength={60} onChange={(e) => set("name_en", e.target.value)} />
            </label>
            <label className="ad-bl-field">
              <span className="ad-bl-label">Name (Tamil)</span>
              <input lang="ta" value={form.name_ta} maxLength={120} onChange={(e) => set("name_ta", e.target.value)} />
            </label>
          </div>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Price (LKR) <small>· {BILLING_LABEL[plan.billing]}</small></span>
            <input inputMode="numeric" value={free ? "0" : form.price} disabled={free}
              onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))} />
            {free && <small className="ad-muted">The free plan always costs nothing.</small>}
          </label>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Description (English)</span>
            <textarea rows={2} value={form.blurb_en} maxLength={255} onChange={(e) => set("blurb_en", e.target.value)} />
          </label>
          <label className="ad-bl-field">
            <span className="ad-bl-label">Description (Tamil)</span>
            <textarea lang="ta" rows={2} value={form.blurb_ta} maxLength={500} onChange={(e) => set("blurb_ta", e.target.value)} />
          </label>
          <div className="ad-pl-toggles">
            <label><input type="checkbox" checked={form.is_visible} onChange={(e) => set("is_visible", e.target.checked)} />
              Show to students</label>
            <label><input type="checkbox" checked={form.highlight} onChange={(e) => set("highlight", e.target.checked)} />
              Mark as best value <small>(removes the badge from the other plan)</small></label>
          </div>
          {error && <p className="ad-bank-warn" role="alert">{error}</p>}
          <div className="ad-st-modal-foot">
            <button type="button" className="db-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="ad-st-btn danger" disabled={busy}>{busy ? "Saving…" : "Save plan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlanCard({ plan, revenueDays, onEdit }: { plan: AdminPlan; revenueDays: number; onEdit: () => void }) {
  const updated = when(plan.updated_at);
  return (
    <article className={`ad-card ad-pl-card${plan.highlight ? " best" : ""}${plan.is_visible ? "" : " hidden"}`}>
      <header className="ad-pl-head">
        <div>
          <h2>{plan.name_en}</h2>
          <p lang="ta" className="ad-muted">{plan.name_ta}</p>
        </div>
        <div className="ad-pl-tags">
          {plan.highlight && <span className="ad-pill ad-pl-best">Best value</span>}
          {!plan.is_visible && <span className="ad-pill expired">Hidden</span>}
        </div>
      </header>
      <p className="ad-pl-price"><span>LKR</span> <strong>{plan.price_lkr.toLocaleString("en-LK")}</strong></p>
      <p className="ad-pl-per ad-muted">{BILLING_LABEL[plan.billing]}</p>
      <p className="ad-pl-blurb">{plan.blurb_en}</p>
      <dl className="ad-pl-stats">
        <div><dt>Students on it</dt><dd>{plan.students.toLocaleString("en-LK")}</dd></div>
        {plan.billing !== "free" && <>
          <div><dt>Last {revenueDays} days</dt><dd>{lkr(plan.revenue_30d)}</dd></div>
          <div><dt>All time</dt><dd>{lkr(plan.revenue_total)}<small> · {plan.payments} paid</small></dd></div>
        </>}
      </dl>
      <footer className="ad-pl-foot">
        <small className="ad-muted">{updated ? `Edited ${updated}` : "Default settings"}</small>
        <button type="button" className="db-btn-outline db-btn-sm" onClick={onEdit}>{icons.pencil}Edit</button>
      </footer>
    </article>
  );
}

export function AdminPlans() {
  const [data, setData] = useState<{ plans: AdminPlan[]; students: number; revenue_days: number }>();
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanInfo["key"] | null>(null);
  const load = useCallback(() => {
    adminApi.plans().then((d) => { setData(d); setFailed(null); },
      (err) => setFailed(loadError(err, "Couldn't load the plans.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const plan = data?.plans.find((p) => p.key === editing);

  return (
    <main className="db-content ad-page">
      <div className="ad-head">
        <div>
          <h1>Plans</h1>
          <p>The price list students see, and how many students are on each plan today.</p>
        </div>
        <Link to="/admin/payments" className="db-btn-outline">{icons.coins}Record a payment</Link>
      </div>
      {failed ? (
        <section className="ad-card" role="alert">
          <p className="ad-pad ad-muted">{failed}</p>
          <button type="button" className="db-btn-outline" onClick={load}>Try again</button>
        </section>
      ) : !data ? (
        <section className="ad-card" role="status"><p className="ad-pad ad-muted">Loading…</p></section>
      ) : (
        <>
          <div className="ad-pl-grid">
            {data.plans.map((p) => <PlanCard key={p.key} plan={p} revenueDays={data.revenue_days} onEdit={() => setEditing(p.key)} />)}
          </div>
          <p className="ad-muted ad-pl-note">
            Online payment isn't connected yet: a paid plan starts when you record a payment. Hidden plans can still be
            recorded. Tamil names and descriptions are shown to Tamil-medium students, so have them checked before saving.
          </p>
        </>
      )}
      {plan && <EditPlan plan={plan} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </main>
  );
}
