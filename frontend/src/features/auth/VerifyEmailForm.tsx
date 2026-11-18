import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { homeFor, setSession, signOut } from "../../app/session";
import { ArrowRight } from "../../components/ui/Button";
import { ApiError, authApi, type User } from "../../services/api";
import { queueWelcome } from "../onboarding/WelcomeModal";
import { Field, ICONS } from "./AuthField";

// After an email + password sign-up the account is signed in but locked (every API call answers
// 403 email_unverified) until the 6-digit code from the email is entered here. Sign-up and log-in
// already sent a code, so this screen starts with the resend button cooling down.

type ErrorKey = keyof ReturnType<typeof useLanguage>["t"]["verify"]["errors"];
const RESEND_SECONDS = 60;

export function VerifyEmailForm() {
  const { t } = useLanguage();
  const v = t.verify;
  const navigate = useNavigate();

  const [user, setUser] = useState<User>();
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<ErrorKey>();
  const [formError, setFormError] = useState<ErrorKey>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  // Who is this? Not signed in -> log in; already verified -> straight to their home.
  useEffect(() => {
    authApi.me().then((u) => {
      if (u.email_verified) navigate(homeFor(u), { replace: true });
      else setUser(u);
    }).catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => { if (user) document.getElementById("ve-code")?.focus(); }, [user]);

  function clear() {
    setFieldError(undefined);
    setFormError(undefined);
    setNotice(undefined);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clear();
    if (!/^\d{6}$/.test(code)) {
      setFieldError("code");
      document.getElementById("ve-code")?.focus();
      return;
    }
    setBusy(true);
    try {
      const { user: verified } = await authApi.verifyEmail(code);
      setSession(verified);
      if (verified.role !== "admin") queueWelcome();   // the dashboard shows the welcome card once
      navigate(homeFor(verified), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 422)) {
        setFieldError("invalidCode");
        setCode("");
        document.getElementById("ve-code")?.focus();
      } else if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
      } else {
        setFormError(err instanceof ApiError ? "generic" : "network");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    clear();
    setBusy(true);
    try {
      await authApi.resendVerification();
      setCode("");
      setNotice(v.resent);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.code === "resend_too_soon") {
        const wait = (err.detail as { retry_after?: number }).retry_after ?? RESEND_SECONDS;
        setCooldown(wait);
        setFormError("tooSoon");
      } else {
        setFormError(err instanceof ApiError ? "generic" : "network");
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut().catch(() => undefined);
    navigate("/signup", { replace: true });
  }

  if (!user) return <div className="su-form li-form" aria-busy="true" />;

  return (
    <form className="su-form li-form" onSubmit={onSubmit} noValidate>
      <div className="su-span">
        <h2 id="ve-heading" className="li-heading">{v.heading}</h2>
        <p className="li-intro">{v.intro.replace("{email}", user.email)}</p>
      </div>

      <Field id="ve-code" label={v.code} icon={ICONS.shield} error={fieldError && v.errors[fieldError]}>
        <input
          id="ve-code"
          className="fp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={v.codePh}
          value={code}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "ve-code-msg" : undefined}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </Field>

      {notice && <p className="fp-notice" role="status">{notice}</p>}
      {formError && <p className="su-form-error" role="alert">{v.errors[formError]}</p>}

      <button type="submit" className="su-submit" disabled={busy} aria-busy={busy}>
        {busy ? v.verifying : v.verify} {!busy && <ArrowRight />}
      </button>

      <div className="fp-actions">
        <button type="button" className="li-linkbtn" disabled={busy || cooldown > 0} onClick={resend}>
          {cooldown > 0 ? v.resendIn.replace("{s}", String(cooldown)) : v.resend}
        </button>
        <button type="button" className="li-linkbtn" onClick={logout}>{v.logout}</button>
      </div>
      <p className="li-alt">{v.spam}</p>
      <p className="li-alt">{v.wrongEmail}</p>
    </form>
  );
}
