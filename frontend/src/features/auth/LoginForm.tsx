import { useEffect, useState, type FormEvent } from "react";
import { queueWelcome } from "../onboarding/WelcomeModal";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { ArrowRight } from "../../components/ui/Button";
import { ApiError, authApi, type User } from "../../services/api";
import { Field, ICONS, PasswordToggle } from "./AuthField";
import { GoogleButton, GoogleProfileForm, useGoogleSignIn } from "./GoogleSignIn";
import { MicrosoftButton } from "./MicrosoftSignIn";
import { EMAIL_RE } from "./validation";

type LoginErrors = Partial<Record<"email" | "password", "email" | "password">>;

export function LoginForm() {
  const { t } = useLanguage();
  const l = t.login;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<keyof typeof l.errors | "socialSoon" | "microsoftSoon">();
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<User>();
  const google = useGoogleSignIn(setUser);
  const navigate = useNavigate();

  // Students land on their dashboard, admins on the admin overview.
  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") queueWelcome();      // the dashboard shows the welcome card once
    navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [user, navigate]);
  const shownError = formError ?? google.error;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const found: LoginErrors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = "email";
    if (!password) found.password = "password";
    setErrors(found);
    if (found.email || found.password) {
      document.getElementById(found.email ? "li-email" : "li-password")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      setUser((await authApi.login(email.trim(), password)).user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("invalid");
        setPassword("");
        document.getElementById("li-password")?.focus();
      } else if (err instanceof ApiError && err.code === "account_disabled") {
        setFormError("disabled");
      } else {
        setFormError(err instanceof ApiError ? "generic" : "network");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (user) {
    return (
      <div className="su-success" role="status" id="li-heading">
        <span className="su-success-tick" aria-hidden="true">{ICONS.tick}</span>
        <h2>{l.successTitle}, {user.full_name.split(" ")[0]}!</h2>
        <p>{l.successText}</p>
        <a href="/dashboard" className="su-submit">{l.successCta} <ArrowRight /></a>
      </div>
    );
  }

  if (google.pending) {
    return <GoogleProfileForm pending={google.pending} onUser={setUser} onCancel={google.cancel} />;
  }

  return (
    <form className="su-form li-form" onSubmit={onSubmit} noValidate>
      <div className="su-span">
        <h2 id="li-heading" className="li-heading">{l.heading}</h2>
        <p className="li-intro">{l.intro}</p>
      </div>

      <Field id="li-email" label={l.email} icon={ICONS.mail} error={errors.email && l.errors.email}>
        <input
          id="li-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={l.emailPh}
          value={email}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "li-email-msg" : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        id="li-password"
        label={l.password}
        icon={ICONS.lock}
        error={errors.password && l.errors.password}
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
          id="li-password"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          placeholder={l.passwordPh}
          value={password}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "li-password-msg" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <a href="/forgot-password" className="li-forgot">{l.forgot}</a>

      {shownError && (
        <p className="su-form-error" role="alert">
          {shownError === "socialSoon" || shownError === "microsoftSoon" ? l[shownError] : l.errors[shownError]}
        </p>
      )}

      <button type="submit" className="su-submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? l.submitting : l.submit} {!submitting && <ArrowRight />}
      </button>

      <p className="li-divider"><span>{l.orContinue}</span></p>

      {/* Each button works once its client ID (GOOGLE_CLIENT_ID / MICROSOFT_CLIENT_ID) is set on the
          backend; until then it explains that it's coming soon. */}
      <div className="li-social">
        <GoogleButton onCredential={google.onCredential} onUnavailable={() => setFormError("socialSoon")} />
        <MicrosoftButton
          onCredential={(token) => { setFormError(undefined); void google.onCredential(token, "microsoft"); }}
          onUnavailable={() => setFormError("microsoftSoon")}
          onFailed={() => google.setError("microsoft")}
        />
      </div>

      <p className="li-alt">
        {l.noAccount} <a href="/signup">{l.signUp}</a>
      </p>
    </form>
  );
}
