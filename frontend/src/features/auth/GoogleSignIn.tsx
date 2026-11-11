import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "../../app/providers";
import { ArrowRight } from "../../components/ui/Button";
import { ApiError, authApi, type GoogleProfileRequired, type User } from "../../services/api";
import { Field, ICONS } from "./AuthField";
import { examYears, validateField, type FieldErrors, type SignupField, type SignupValues } from "./validation";

// Google sign-in via Google Identity Services: Google's own button hands us an ID
// token, the backend verifies it. The client ID comes from GET /auth/providers so
// the frontend needs no extra config.

interface GsiApi {
  accounts: {
    id: {
      initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }): void;
      renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GsiApi;
  }
}

let gsiScript: Promise<GsiApi> | undefined;
function loadGsi(): Promise<GsiApi> {
  gsiScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error("gsi missing")));
    s.onerror = () => {
      gsiScript = undefined; // allow a retry on the next mount
      reject(new Error("gsi failed to load"));
    };
    document.head.appendChild(s);
  });
  return gsiScript;
}

type Providers = { google_client_id: string | null; microsoft_client_id: string | null };
let providers: Promise<Providers> | undefined;
/** Which social logins the backend has switched on (GET /auth/providers, asked once per page load). */
export function socialProviders(): Promise<Providers> {
  providers ??= authApi.providers().catch(() => ({ google_client_id: null, microsoft_client_id: null }));
  return providers;
}
const googleClientId = () => socialProviders().then((p) => p.google_client_id);

export type SocialProvider = "google" | "microsoft";
export type GooglePending = GoogleProfileRequired & { credential: string; provider: SocialProvider };
export type SocialError = "google" | "microsoft" | "microsoftUnverified" | "network" | "disabled";

/** Shared by the log-in and sign-up forms: turns a Google or Microsoft ID token into a user
 *  (or a pending profile, for a first sign-in). */
export function useGoogleSignIn(onUser: (user: User) => void) {
  const [pending, setPending] = useState<GooglePending>();
  const [error, setError] = useState<SocialError>();

  async function onCredential(credential: string, provider: SocialProvider = "google") {
    setError(undefined);
    try {
      onUser((await authApi[provider](credential)).user);
    } catch (err) {
      if (err instanceof ApiError && err.code === "profile_required") {
        setPending({ ...(err.detail as GoogleProfileRequired), credential, provider });
      } else if (err instanceof ApiError && err.code === "account_disabled") {
        setError("disabled");
      } else if (err instanceof ApiError && err.code === "microsoft_email_unverified") {
        setError("microsoftUnverified");
      } else {
        setError(err instanceof ApiError ? provider : "network");
      }
    }
  }

  return { pending, cancel: () => setPending(undefined), error, setError, onCredential };
}

/** Google's official button, or our look-alike that explains it's not set up yet. */
export function GoogleButton({ onCredential, onUnavailable }: { onCredential: (c: string) => void; onUnavailable: () => void }) {
  const { lang, t } = useLanguage();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "off">("loading");
  // Google calls back into whichever handler was current at init time; keep it fresh.
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    let alive = true;
    googleClientId()
      .then((clientId) => {
        if (!clientId) throw new Error("not configured");
        return loadGsi().then((gsi) => ({ gsi, clientId }));
      })
      .then(({ gsi, clientId }) => {
        if (!alive || !box.current) return;
        gsi.accounts.id.initialize({ client_id: clientId, callback: (r) => handler.current(r.credential), ux_mode: "popup" });
        gsi.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: lang,
          width: Math.min(400, Math.max(200, box.current.offsetWidth)),
        });
        setState("ready");
      })
      .catch(() => alive && setState("off"));
    return () => {
      alive = false;
    };
  }, [lang]);

  if (state === "off") {
    return (
      <button type="button" onClick={onUnavailable}>
        {ICONS.google}
        {t.login.google}
      </button>
    );
  }
  return <div ref={box} className="li-google" aria-busy={state === "loading"} />;
}

const PROFILE_FIELDS: SignupField[] = ["mobile", "al_exam_year", "accept_terms"];

/** One-time form after a first Google or Microsoft sign-in: they gave us name and email, KELU needs the rest. */
export function GoogleProfileForm({ pending, onUser, onCancel }: { pending: GooglePending; onUser: (u: User) => void; onCancel: () => void }) {
  const { lang, t } = useLanguage();
  const s = t.signup;
  const g = t.login.googleProfile;

  const [values, setValues] = useState<SignupValues>({
    full_name: pending.full_name,
    email: pending.email,
    mobile: "",
    password: "",
    medium: lang,
    al_exam_year: "",
    accept_terms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<"network" | "generic" | "google">();
  const providerError = pending.provider === "microsoft" ? t.login.errors.microsoft : t.login.errors.google;
  const [submitting, setSubmitting] = useState(false);
  const msg = (key?: string) => (key ? s.errors[key as keyof typeof s.errors] : undefined);
  const update = <K extends keyof SignupValues>(key: K, value: SignupValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const found: FieldErrors = {};
    for (const f of PROFILE_FIELDS) {
      const err = validateField(f, values);
      if (err) found[f] = err;
    }
    setErrors(found);
    const first = PROFILE_FIELDS.find((f) => found[f]);
    if (first) {
      document.getElementById(`gp-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await authApi[pending.provider](pending.credential, {
        mobile: values.mobile,
        medium: values.medium,
        al_exam_year: Number(values.al_exam_year),
        accept_terms: values.accept_terms,
      });
      onUser(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const serverErrors: FieldErrors = {};
        for (const f of err.fields) if ((PROFILE_FIELDS as string[]).includes(f)) serverErrors[f as SignupField] = f;
        setErrors(serverErrors);
        if (!Object.keys(serverErrors).length) setFormError("generic");
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError("google"); // the ID token lasts an hour; they need to click the button again
      } else {
        setFormError(err instanceof ApiError ? "generic" : "network");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="su-form li-form" onSubmit={onSubmit} noValidate>
      <div className="su-span">
        <h2 id="li-heading" className="li-heading">{g.heading}</h2>
        <p className="li-intro">{g.intro}</p>
        <p className="gp-who">{ICONS[pending.provider]}<span><strong>{pending.full_name}</strong> · {pending.email}</span></p>
      </div>

      <Field id="gp-mobile" label={s.mobile} icon={ICONS.phone} error={msg(errors.mobile)} help={s.mobileHelp}>
        <input
          id="gp-mobile"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder={s.mobilePh}
          value={values.mobile}
          aria-invalid={!!errors.mobile}
          aria-describedby="gp-mobile-msg"
          onChange={(e) => update("mobile", e.target.value)}
        />
      </Field>

      <fieldset className="su-field su-medium">
        <legend>{s.medium}</legend>
        <div className="su-medium-opts">
          {(["ta", "en"] as const).map((m) => (
            <label key={m} className={values.medium === m ? "selected" : ""}>
              <input type="radio" name="gp-medium" value={m} checked={values.medium === m} onChange={() => update("medium", m)} />
              <span lang={m}>{m === "ta" ? "தமிழ்" : "English"}</span>
              {values.medium === m && <span className="su-medium-tick" aria-hidden="true">{ICONS.tick}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id="gp-al_exam_year"
        label={s.examYear}
        icon={ICONS.calendar}
        error={msg(errors.al_exam_year)}
        trailing={<span className="su-chevron" aria-hidden="true">{ICONS.chevron}</span>}
      >
        <select
          id="gp-al_exam_year"
          value={values.al_exam_year}
          className={values.al_exam_year ? "" : "placeholder"}
          aria-invalid={!!errors.al_exam_year}
          onChange={(e) => update("al_exam_year", e.target.value)}
        >
          <option value="" disabled>{s.examYearPh}</option>
          {examYears().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>

      <div className={errors.accept_terms ? "su-terms su-span has-error" : "su-terms su-span"}>
        <label>
          <input
            id="gp-accept_terms"
            type="checkbox"
            checked={values.accept_terms}
            aria-invalid={!!errors.accept_terms}
            onChange={(e) => update("accept_terms", e.target.checked)}
          />
          <span>
            {s.agreeLead} <a href="/terms" target="_blank" rel="noreferrer">{s.terms}</a> {s.and}{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">{s.privacy}</a>
            {s.agreeTail && <> {s.agreeTail}</>}
          </span>
        </label>
        {errors.accept_terms && <p className="su-error" role="alert">{msg(errors.accept_terms)}</p>}
      </div>

      {formError && <p className="su-form-error" role="alert">{formError === "google" ? providerError : s.errors[formError]}</p>}

      <button type="submit" className="su-submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? g.submitting : g.submit} {!submitting && <ArrowRight />}
      </button>
      <button type="button" className="li-linkbtn" onClick={onCancel}>{g.back}</button>
    </form>
  );
}
