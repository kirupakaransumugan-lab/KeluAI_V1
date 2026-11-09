import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import { ApiError, authApi, type Medium, type ProfileUpdate } from "../../services/api";
import { fill } from "../../utils/dates";
import { EMAIL_RE, MOBILE_RE, examYears } from "../auth/validation";
import { icons } from "../dashboard/icons";
import "../../styles/account.css";

// Profile (PATCH /auth/me), password (POST /auth/password/change) and account deletion
// (DELETE /auth/me). The checks here mirror the server's for instant feedback; the server decides.

const BCRYPT_MAX_BYTES = 72;
type Note = { kind: "ok" | "error"; text: string } | null;

/** Local 07X form for editing: the server stores +947XXXXXXXX. */
const localMobile = (e164: string) => (e164.startsWith("+94") ? `0${e164.slice(3)}` : e164);

function Field({ id, label, help, error, children }: {
  id: string; label: string; help?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className={`ac-field${error ? " invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="ac-error" id={`${id}-msg`}>{error}</p> : help && <p className="ac-help" id={`${id}-msg`}>{help}</p>}
    </div>
  );
}

function Status({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`ac-form-note ${note.kind}`} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>;
}

export function SettingsPage() {
  const { t } = useLanguage();
  const st = t.dashboard.settings;
  return (
    <main className="db-content ac-page">
      <header className="ac-head">
        <span className="ac-head-icon" aria-hidden="true">{icons.gear}</span>
        <div>
          <h1>{st.title}</h1>
          <p>{st.subtitle}</p>
        </div>
      </header>
      <ProfileForm />
      <PasswordForm />
      <DeleteAccount />
    </main>
  );
}

function ProfileForm() {
  const { user, setUser } = useOutletContext<DashboardContext>();
  const { t } = useLanguage();
  const st = t.dashboard.settings;
  const pr = st.profile;
  const [name, setName] = useState(user.full_name);
  const [mobile, setMobile] = useState(localMobile(user.mobile));
  const [medium, setMedium] = useState<Medium>(user.medium ?? "en");
  const [year, setYear] = useState(String(user.al_exam_year ?? ""));
  const [parent, setParent] = useState(user.parent_email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  // A past exam year the server still has on file stays selectable, so saving other fields works.
  const years = [...new Set([...(user.al_exam_year ? [user.al_exam_year] : []), ...examYears()])].sort();
  const isStudent = user.role === "student";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().replace(/\s+/g, " ").length < 2) errs.name = st.errors.name;
    if (!MOBILE_RE.test(mobile.replace(/[\s\-()]/g, ""))) errs.mobile = st.errors.mobile;
    if (parent.trim() && !EMAIL_RE.test(parent.trim())) errs.parent = st.errors.email;
    setErrors(errs);
    setNote(null);
    if (Object.keys(errs).length) return;

    const changes: ProfileUpdate = { full_name: name, mobile };
    if (isStudent) {
      changes.medium = medium;
      if (year && Number(year) !== user.al_exam_year) changes.al_exam_year = Number(year);
      if (parent.trim()) changes.parent_email = parent.trim();
      else if (user.parent_email) changes.clear_parent_email = true;
    }
    setBusy(true);
    try {
      const updated = await authApi.updateProfile(changes);
      setUser(updated);
      setParent(updated.parent_email ?? "");
      setNote({ kind: "ok", text: pr.saved });
    } catch (err) {
      // 422: a field the server rejected (its "loc" ends with the field name).
      const detail = err instanceof ApiError && Array.isArray(err.detail) ? err.detail as { loc: string[] }[] : [];
      const fields = new Set(detail.map((d) => d.loc[d.loc.length - 1]));
      if (fields.has("mobile")) setErrors({ mobile: st.errors.mobile });
      else if (fields.has("parent_email")) setErrors({ parent: st.errors.email });
      else if (fields.has("full_name")) setErrors({ name: st.errors.name });
      else setNote({ kind: "error", text: st.errors.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ac-card" aria-labelledby="ac-profile-title">
      <h2 id="ac-profile-title" className="ac-card-title">{pr.title}</h2>
      <p className="ac-muted">{pr.text}</p>
      <form className="ac-form" onSubmit={submit} noValidate>
        <div className="ac-grid">
          <Field id="ac-name" label={pr.fullName} error={errors.name}>
            <input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
              maxLength={120} aria-invalid={!!errors.name} aria-describedby="ac-name-msg" />
          </Field>
          <Field id="ac-email" label={pr.email} help={pr.emailNote}>
            <input id="ac-email" value={user.email} readOnly aria-describedby="ac-email-msg" />
          </Field>
          <Field id="ac-mobile" label={pr.mobile} help={pr.mobileHelp} error={errors.mobile}>
            <input id="ac-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel"
              autoComplete="tel" placeholder="07X XXX XXXX" aria-invalid={!!errors.mobile} aria-describedby="ac-mobile-msg" />
          </Field>
          {isStudent && (
            <>
              <Field id="ac-year" label={pr.examYear}>
                <select id="ac-year" value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <div className="ac-field">
                <span className="ac-label" id="ac-medium-label">{pr.medium}</span>
                <div className="ac-segment" role="radiogroup" aria-labelledby="ac-medium-label">
                  {(["ta", "en"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={medium === m}
                      className={medium === m ? "on" : ""} onClick={() => setMedium(m)}>
                      {t.dashboard.medium[m]}
                    </button>
                  ))}
                </div>
              </div>
              <Field id="ac-parent" label={pr.parentEmail} help={pr.parentEmailHelp} error={errors.parent}>
                <input id="ac-parent" type="email" value={parent} onChange={(e) => setParent(e.target.value)}
                  autoComplete="off" aria-invalid={!!errors.parent} aria-describedby="ac-parent-msg" />
              </Field>
            </>
          )}
        </div>
        <div className="ac-actions">
          <Status note={note} />
          <button type="submit" className="db-btn-primary" disabled={busy}>{pr.save}</button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { user, setUser } = useOutletContext<DashboardContext>();
  const { t } = useLanguage();
  const st = t.dashboard.settings;
  const pw = st.password;
  const hasPassword = user.has_password;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (hasPassword && !current) errs.current = st.errors.currentRequired;
    if (next.length < 8) errs.next = st.errors.passwordShort;
    else if (new TextEncoder().encode(next).length > BCRYPT_MAX_BYTES) errs.next = st.errors.passwordTooLong;
    if (!errs.next && confirm !== next) errs.confirm = st.errors.mismatch;
    setErrors(errs);
    setNote(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await authApi.changePassword(hasPassword ? current : null, next);
      setUser(r.user);
      setCurrent(""); setNext(""); setConfirm("");
      setNote({ kind: "ok", text: pw.saved });
    } catch (err) {
      if (err instanceof ApiError && err.code === "wrong_password") setErrors({ current: st.errors.wrongPassword });
      else setNote({ kind: "error", text: st.errors.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ac-card" aria-labelledby="ac-password-title">
      <h2 id="ac-password-title" className="ac-card-title">{hasPassword ? pw.title : pw.setTitle}</h2>
      <p className="ac-muted">{hasPassword ? pw.text : pw.setText}</p>
      <form className="ac-form" onSubmit={submit} noValidate>
        {/* Lets password managers attach the new password to the right account. */}
        <input type="email" value={user.email} autoComplete="username" readOnly hidden />
        <div className="ac-grid">
          {hasPassword && (
            <Field id="ac-current" label={pw.current} error={errors.current}>
              <input id="ac-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password" aria-invalid={!!errors.current} aria-describedby="ac-current-msg" />
            </Field>
          )}
          <Field id="ac-new" label={pw.new} error={errors.next} help={st.errors.passwordShort}>
            <input id="ac-new" type="password" value={next} onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password" aria-invalid={!!errors.next} aria-describedby="ac-new-msg" />
          </Field>
          <Field id="ac-confirm" label={pw.confirm} error={errors.confirm}>
            <input id="ac-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" aria-invalid={!!errors.confirm} aria-describedby="ac-confirm-msg" />
          </Field>
        </div>
        <div className="ac-actions">
          <Status note={note} />
          <button type="submit" className="db-btn-primary" disabled={busy}>{pw.save}</button>
        </div>
      </form>
    </section>
  );
}

function DeleteAccount() {
  const { user } = useOutletContext<DashboardContext>();
  const { t } = useLanguage();
  const st = t.dashboard.settings;
  const dz = st.danger;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  // The button stays disabled until the typed email matches: a deliberate, two-step action.
  const matches = email.trim().toLowerCase() === user.email.toLowerCase();

  if (user.role !== "student") return null;          // admin accounts are managed from the backend

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches) return setErrors({ email: st.errors.confirmMismatch });
    setErrors({});
    setNote(null);
    setBusy(true);
    try {
      await authApi.deleteAccount(email.trim(), user.has_password ? password : null);
      navigate("/", { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "wrong_password") setErrors({ password: st.errors.wrongPassword });
      else if (code === "confirm_mismatch") setErrors({ email: st.errors.confirmMismatch });
      else setNote({ kind: "error", text: st.errors.failed });
      setBusy(false);
    }
  };

  return (
    <section className="ac-card ac-danger" aria-labelledby="ac-danger-title">
      <h2 id="ac-danger-title" className="ac-card-title">{dz.title}</h2>
      <p className="ac-muted">{dz.text}</p>
      {!open ? (
        <div className="ac-actions">
          <button type="button" className="ac-btn-danger-outline" onClick={() => setOpen(true)}>{dz.open}</button>
        </div>
      ) : (
        <form className="ac-form" onSubmit={submit} noValidate>
          <div className="ac-grid">
            <Field id="ac-del-email" label={fill(dz.confirmEmail, { email: user.email })} error={errors.email}>
              <input id="ac-del-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="off" aria-invalid={!!errors.email} aria-describedby="ac-del-email-msg" />
            </Field>
            {user.has_password && (
              <Field id="ac-del-pw" label={dz.password} error={errors.password}>
                <input id="ac-del-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby="ac-del-pw-msg" />
              </Field>
            )}
          </div>
          <div className="ac-actions">
            <Status note={note} />
            <button type="button" className="db-btn-outline" onClick={() => { setOpen(false); setEmail(""); setPassword(""); setErrors({}); }}>
              {dz.cancel}
            </button>
            <button type="submit" className="ac-btn-danger" disabled={busy || !matches || (user.has_password && !password)}>
              {dz.confirm}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
