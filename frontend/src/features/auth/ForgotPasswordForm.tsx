import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../../app/providers";
import { ArrowRight } from "../../components/ui/Button";
import { ApiError, authApi } from "../../services/api";
import { Field, ICONS, PasswordToggle } from "./AuthField";
import { EMAIL_RE, validateField } from "./validation";

// Three steps: email -> 6-digit code from the email -> new password.
// The reset token from step 2 only lives in memory, never in storage or the URL.

type Step = "email" | "code" | "password" | "done";
type ErrorKey = keyof ReturnType<typeof useLanguage>["t"]["forgot"]["errors"];

const RESEND_SECONDS = 60;

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const f = t.forgot;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; key: ErrorKey }>();
  const [formError, setFormError] = useState<ErrorKey>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    // Move focus to the new step's first input so keyboard and screen-reader users follow along.
    document.getElementById({ email: "fp-email", code: "fp-code", password: "fp-password", done: "fp-done" }[step])?.focus();
  }, [step]);

  function fail(err: unknown) {
    setFormError(err instanceof ApiError ? "generic" : "network");
  }

  function reset(field?: string, key?: ErrorKey) {
    setFormError(undefined);
    setNotice(undefined);
    setFieldError(field && key ? { field, key } : undefined);
    if (field) document.getElementById(field)?.focus();
  }

  async function sendCode(isResend = false) {
    reset();
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      setCooldown(RESEND_SECONDS);
      setCode("");
      if (isResend) setNotice(f.resent);
      setStep("code");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) reset("fp-email", "email");
      else fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitEmail(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return reset("fp-email", "email");
    await sendCode();
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return reset("fp-code", "code");
    reset();
    setBusy(true);
    try {
      setResetToken((await authApi.verifyResetCode(email.trim(), code)).reset_token);
      setStep("password");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 422)) reset("fp-code", "invalidCode");
      else fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    const pwError = validateField("password", { password } as Parameters<typeof validateField>[1]);
    if (pwError) return reset("fp-password", pwError === "passwordTooLong" ? "passwordTooLong" : "password");
    if (password !== confirm) return reset("fp-confirm", "mismatch");
    reset();
    setBusy(true);
    try {
      await authApi.resetPassword(resetToken, password);
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // Token expired or already used: back to the start.
        setResetToken("");
        setStep("email");
        setFormError("expired");
      } else fail(err);
    } finally {
      setBusy(false);
    }
  }

  const errFor = (id: string) => (fieldError?.field === id ? f.errors[fieldError.key] : undefined);
  const messages = (
    <>
      {notice && <p className="fp-notice" role="status">{notice}</p>}
      {formError && <p className="su-form-error" role="alert">{f.errors[formError]}</p>}
    </>
  );

  if (step === "done") {
    return (
      <div className="su-success" role="status">
        <span className="su-success-tick" aria-hidden="true">{ICONS.tick}</span>
        <h2 id="fp-heading">{f.doneTitle}</h2>
        <p>{f.doneText}</p>
        <a href="/" id="fp-done" className="su-submit">{f.doneCta} <ArrowRight /></a>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form className="su-form li-form" onSubmit={onSubmitEmail} noValidate>
        <div className="su-span">
          <h2 id="fp-heading" className="li-heading">{f.emailHeading}</h2>
          <p className="li-intro">{f.emailIntro}</p>
        </div>
        <Field id="fp-email" label={f.email} icon={ICONS.mail} error={errFor("fp-email")}>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder={f.emailPh}
            value={email}
            aria-invalid={!!errFor("fp-email")}
            aria-describedby={errFor("fp-email") ? "fp-email-msg" : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {messages}
        <button type="submit" className="su-submit" disabled={busy} aria-busy={busy}>
          {busy ? f.sending : f.sendCode} {!busy && <ArrowRight />}
        </button>
        <p className="li-alt"><a href="/login">{f.backToLogin}</a></p>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form className="su-form li-form" onSubmit={onSubmitCode} noValidate>
        <div className="su-span">
          <h2 id="fp-heading" className="li-heading">{f.codeHeading}</h2>
          <p className="li-intro">{f.codeIntro.replace("{email}", email.trim())}</p>
        </div>
        <Field id="fp-code" label={f.code} icon={ICONS.shield} error={errFor("fp-code")}>
          <input
            id="fp-code"
            className="fp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={f.codePh}
            value={code}
            aria-invalid={!!errFor("fp-code")}
            aria-describedby={errFor("fp-code") ? "fp-code-msg" : undefined}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        {messages}
        <button type="submit" className="su-submit" disabled={busy} aria-busy={busy}>
          {busy ? f.verifying : f.verify} {!busy && <ArrowRight />}
        </button>
        <div className="fp-actions">
          <button type="button" className="li-linkbtn" disabled={busy || cooldown > 0} onClick={() => sendCode(true)}>
            {cooldown > 0 ? f.resendIn.replace("{s}", String(cooldown)) : f.resend}
          </button>
          <button type="button" className="li-linkbtn" onClick={() => { reset(); setStep("email"); }}>
            {f.changeEmail}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="su-form li-form" onSubmit={onSubmitPassword} noValidate>
      <div className="su-span">
        <h2 id="fp-heading" className="li-heading">{f.passwordHeading}</h2>
        <p className="li-intro">{f.passwordIntro}</p>
      </div>
      {/* Hidden username lets password managers save the new password against the right account. */}
      <input type="email" autoComplete="username" value={email.trim()} readOnly hidden />
      <Field
        id="fp-password"
        label={f.newPassword}
        icon={ICONS.lock}
        error={errFor("fp-password")}
        trailing={
          <PasswordToggle
            shown={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            showLabel={t.signup.showPassword}
            hideLabel={t.signup.hidePassword}
          />
        }
      >
        <input
          id="fp-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={f.newPasswordPh}
          value={password}
          aria-invalid={!!errFor("fp-password")}
          aria-describedby={errFor("fp-password") ? "fp-password-msg" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field id="fp-confirm" label={f.confirmPassword} icon={ICONS.lock} error={errFor("fp-confirm")}>
        <input
          id="fp-confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={f.confirmPasswordPh}
          value={confirm}
          aria-invalid={!!errFor("fp-confirm")}
          aria-describedby={errFor("fp-confirm") ? "fp-confirm-msg" : undefined}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {messages}
      <button type="submit" className="su-submit" disabled={busy} aria-busy={busy}>
        {busy ? f.saving : f.save} {!busy && <ArrowRight />}
      </button>
    </form>
  );
}
