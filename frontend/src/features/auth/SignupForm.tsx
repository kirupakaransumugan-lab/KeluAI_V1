import { useState, type FormEvent } from "react";
import { useLanguage } from "../../app/providers";
import { ArrowRight } from "../../components/ui/Button";
import { ApiError, authApi, type User } from "../../services/api";
import { Field, ICONS } from "./AuthField";
import { GoogleButton, GoogleProfileForm, useGoogleSignIn } from "./GoogleSignIn";
import {
  examYears,
  passwordScore,
  validateField,
  type FieldErrors,
  type SignupField,
  type SignupValues,
} from "./validation";

const FIELDS: SignupField[] = ["full_name", "email", "mobile", "password", "al_exam_year", "accept_terms"];

export function SignupForm() {
  const { lang, t } = useLanguage();
  const s = t.signup;
  const years = examYears();

  const [values, setValues] = useState<SignupValues>({
    full_name: "",
    email: "",
    mobile: "",
    password: "",
    medium: lang,
    al_exam_year: "",
    accept_terms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<User>();
  const google = useGoogleSignIn(setCreated);
  const [googleOff, setGoogleOff] = useState(false);

  const msg = (key?: string) => (key ? s.errors[key as keyof typeof s.errors] : undefined);

  const update = <K extends keyof SignupValues>(key: K, value: SignupValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    // Once a field has shown an error, re-check it as the student types so the message clears.
    if (key !== "medium" && errors[key as SignupField]) {
      setErrors((e) => ({ ...e, [key]: validateField(key as SignupField, next) }));
    }
  };

  const onBlur = (field: SignupField) => {
    // Don't nag about empty fields the student hasn't filled in yet.
    if (values[field] === "") return;
    setErrors((e) => ({ ...e, [field]: validateField(field, values) }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const found: FieldErrors = {};
    for (const f of FIELDS) {
      const err = validateField(f, values);
      if (err) found[f] = err;
    }
    setErrors(found);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      document.getElementById(`su-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await authApi.register({ ...values, al_exam_year: Number(values.al_exam_year) });
      setCreated(user);
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") {
        setErrors({ email: "emailTaken" });
        document.getElementById("su-email")?.focus();
      } else if (err instanceof ApiError && err.status === 422) {
        const serverErrors: FieldErrors = {};
        for (const f of err.fields) if ((FIELDS as string[]).includes(f)) serverErrors[f as SignupField] = f;
        setErrors(serverErrors);
        if (!Object.keys(serverErrors).length) setFormError("generic");
      } else {
        setFormError(err instanceof ApiError ? "generic" : "network");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const ends = created.trial_ends_at
      ? new Date(created.trial_ends_at + "Z").toLocaleDateString(lang === "ta" ? "ta-LK" : "en-LK", { dateStyle: "long" })
      : "";
    return (
      <div className="su-success" role="status" id="su-heading">
        <span className="su-success-tick" aria-hidden="true">{ICONS.tick}</span>
        <h2>{s.successTitle}, {created.full_name.split(" ")[0]}!</h2>
        <p>{s.successText} <strong>{ends}</strong>.</p>
        <a href="/dashboard" className="su-submit">{s.successCta} <ArrowRight /></a>
      </div>
    );
  }

  if (google.pending) {
    return <GoogleProfileForm pending={google.pending} onUser={setCreated} onCancel={google.cancel} />;
  }

  const score = passwordScore(values.password);
  const describedBy = (f: SignupField) => (errors[f] || f === "mobile" || f === "password" ? `su-${f}-msg` : undefined);

  return (
    <form className="su-form" onSubmit={onSubmit} noValidate>
      <div className="su-span">
        <div className="su-form-tags">
          <span className="su-badge">✦ {s.badge}</span>
          <span className="su-nocard">{ICONS.card}{s.noCard}</span>
        </div>
        <h2 id="su-heading" className="su-heading">{s.formTitle}</h2>
      </div>
      <Field id="su-full_name" label={s.fullName} icon={ICONS.user} error={msg(errors.full_name)}>
        <input
          id="su-full_name"
          name="name"
          autoComplete="name"
          placeholder={s.fullNamePh}
          value={values.full_name}
          maxLength={120}
          aria-invalid={!!errors.full_name}
          aria-describedby={describedBy("full_name")}
          onChange={(e) => update("full_name", e.target.value)}
          onBlur={() => onBlur("full_name")}
        />
      </Field>

      <Field id="su-email" label={s.email} icon={ICONS.mail} error={msg(errors.email)}>
        <input
          id="su-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={s.emailPh}
          value={values.email}
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email")}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => onBlur("email")}
        />
      </Field>

      <Field id="su-mobile" label={s.mobile} icon={ICONS.phone} error={msg(errors.mobile)} help={s.mobileHelp}>
        <input
          id="su-mobile"
          type="tel"
          name="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder={s.mobilePh}
          value={values.mobile}
          aria-invalid={!!errors.mobile}
          aria-describedby={describedBy("mobile")}
          onChange={(e) => update("mobile", e.target.value)}
          onBlur={() => onBlur("mobile")}
        />
      </Field>

      <Field
        id="su-password"
        label={s.password}
        icon={ICONS.lock}
        error={msg(errors.password)}
        help={
          <div className="su-strength">
            <span className="su-strength-hint">{ICONS.shield}{s.passwordHelp}</span>
            {score > 0 && <span className={`su-strength-label s${score}`}>{s.strength[score - 1]}</span>}
            <span className={`su-dots s${score}`} aria-hidden="true">
              {[1, 2, 3, 4].map((i) => <i key={i} className={i <= score ? "on" : ""} />)}
            </span>
          </div>
        }
        trailing={
          <button
            type="button"
            className="su-eye"
            aria-label={showPassword ? s.hidePassword : s.showPassword}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? ICONS.eye : ICONS.eyeOff}
          </button>
        }
      >
        <input
          id="su-password"
          type={showPassword ? "text" : "password"}
          name="new-password"
          autoComplete="new-password"
          placeholder={s.passwordPh}
          value={values.password}
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password")}
          onChange={(e) => update("password", e.target.value)}
          onBlur={() => onBlur("password")}
        />
      </Field>

      <fieldset className="su-field su-medium">
        <legend>{s.medium}</legend>
        <div className="su-medium-opts">
          {(["ta", "en"] as const).map((m) => (
            <label key={m} className={values.medium === m ? "selected" : ""}>
              <input
                type="radio"
                name="medium"
                value={m}
                checked={values.medium === m}
                onChange={() => update("medium", m)}
              />
              <span lang={m}>{m === "ta" ? "தமிழ்" : "English"}</span>
              {values.medium === m && <span className="su-medium-tick" aria-hidden="true">{ICONS.tick}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id="su-al_exam_year"
        label={s.examYear}
        icon={ICONS.calendar}
        error={msg(errors.al_exam_year)}
        trailing={<span className="su-chevron" aria-hidden="true">{ICONS.chevron}</span>}
      >
        <select
          id="su-al_exam_year"
          value={values.al_exam_year}
          className={values.al_exam_year ? "" : "placeholder"}
          aria-invalid={!!errors.al_exam_year}
          aria-describedby={describedBy("al_exam_year")}
          onChange={(e) => update("al_exam_year", e.target.value)}
        >
          <option value="" disabled>{s.examYearPh}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>

      <div className={errors.accept_terms ? "su-terms su-span has-error" : "su-terms su-span"}>
        <label>
          <input
            id="su-accept_terms"
            type="checkbox"
            checked={values.accept_terms}
            aria-invalid={!!errors.accept_terms}
            aria-describedby={describedBy("accept_terms")}
            onChange={(e) => update("accept_terms", e.target.checked)}
          />
          <span>
            {s.agreeLead} <a href="/terms" target="_blank" rel="noreferrer">{s.terms}</a> {s.and}{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">{s.privacy}</a>
            {s.agreeTail && <> {s.agreeTail}</>}
          </span>
        </label>
        {errors.accept_terms && <p className="su-error" id="su-accept_terms-msg" role="alert">{msg(errors.accept_terms)}</p>}
      </div>

      {formError && <p className="su-form-error su-span" role="alert">{msg(formError)}</p>}

      <button type="submit" className="su-submit su-span" disabled={submitting} aria-busy={submitting}>
        {submitting ? s.submitting : s.submit} {!submitting && <ArrowRight />}
      </button>

      <p className="li-divider su-span"><span>{t.login.orContinue}</span></p>
      <div className="li-social su-span su-social-one">
        <GoogleButton onCredential={google.onCredential} onUnavailable={() => setGoogleOff(true)} />
      </div>
      {(google.error || googleOff) && (
        <p className="su-form-error su-span" role="alert">
          {googleOff ? t.login.socialSoon : google.error === "network" ? s.errors.network : t.login.errors.google}
        </p>
      )}

      <p className="su-alt su-span">
        {s.haveAccount} <a href="/login">{s.login}</a>
      </p>
    </form>
  );
}
