import { useEffect, useRef, useState } from "react";
import { BrowserAuthError, PublicClientApplication } from "@azure/msal-browser";
import { useLanguage } from "../../app/providers";
import { ICONS } from "./AuthField";
import { socialProviders } from "./GoogleSignIn";

// Microsoft sign-in with MSAL.js: a Microsoft popup returns an ID token, which the backend
// verifies (POST /auth/microsoft), exactly like the Google flow. The client ID comes from
// GET /auth/providers, so the frontend needs no config of its own.
//
// The popup comes back to /auth/microsoft-popup.html, a blank page; register that exact URL
// as a "Single-page application" redirect URI on the app registration in Microsoft Entra.

const REDIRECT_PATH = "/auth/microsoft-popup.html";
// "common": personal Microsoft accounts and work/school accounts. The backend still refuses a
// work account whose email Microsoft hasn't verified.
const AUTHORITY = "https://login.microsoftonline.com/common";

let msal: Promise<PublicClientApplication | null> | undefined;
/** One MSAL instance per page load, created and initialised before any click (so the click can
 *  open the popup straight away and browsers don't block it). Null when Microsoft is switched off. */
function microsoftClient(): Promise<PublicClientApplication | null> {
  msal ??= socialProviders().then(async ({ microsoft_client_id: clientId }) => {
    if (!clientId) return null;
    const app = new PublicClientApplication({
      auth: { clientId, authority: AUTHORITY, redirectUri: window.location.origin + REDIRECT_PATH },
      cache: { cacheLocation: "sessionStorage" },   // KELU's own session cookie is what keeps them logged in
    });
    await app.initialize();
    return app;
  }).catch(() => {
    msal = undefined;   // allow a retry on the next mount
    return null;
  });
  return msal;
}

export function MicrosoftButton({ onCredential, onUnavailable, onFailed }: {
  onCredential: (idToken: string) => void;
  onUnavailable: () => void;      // Microsoft isn't set up on the backend
  onFailed: () => void;           // the popup failed (not: the student closed it)
}) {
  const { t } = useLanguage();
  const [app, setApp] = useState<PublicClientApplication | null | undefined>();   // undefined: still loading
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    microsoftClient().then((a) => alive.current && setApp(a));
    return () => { alive.current = false; };
  }, []);

  async function signIn() {
    if (!app) { onUnavailable(); return; }
    setBusy(true);
    try {
      const result = await app.loginPopup({ scopes: ["openid", "profile", "email"], prompt: "select_account" });
      onCredential(result.idToken);
    } catch (err) {
      // Closing the popup is a choice, not an error.
      if (!(err instanceof BrowserAuthError && err.errorCode === "user_cancelled")) onFailed();
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <button type="button" onClick={signIn} disabled={busy || app === undefined} aria-busy={busy}>
      {ICONS.microsoft}
      {t.login.microsoft}
    </button>
  );
}
