import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { quizzesApi, type User } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import "../../styles/welcome.css";

// The welcome card a student sees right after logging in or signing up: a "how to use KELU"
// video, then their dashboard. Exam-year students also get the full syllabus quiz card with its
// own video. Who may take that quiz is decided by the server (GET /quizzes/subjects), not here.
//
// Videos live in frontend/public/onboarding/. Until a file is there, the card shows the three
// steps instead, so it is useful before the videos are recorded.

export const WELCOME_VIDEOS = {
  main: "/onboarding/KELU_Browser_Intro_16x9.mp4",
  full: "/onboarding/full-syllabus-quiz.mp4",
};
const REDIRECT_SECONDS = 5;
const QUEUE_KEY = "kelu-welcome";                       // sessionStorage: set at login, read once

/** Call after a successful student login or sign-up: the dashboard shows the card once. */
export function queueWelcome(): void {
  try { sessionStorage.setItem(QUEUE_KEY, "1"); } catch { /* private mode: no card, nothing breaks */ }
}

/** True after every login: the card always shows, and "Skip intro" is how a student passes it.
 *  Only reads the flag: React StrictMode runs the dashboard's effect twice, and a read that also
 *  cleared it made the second run return false and hide the card. The card clears it once shown. */
export function takeWelcome(): boolean {
  try {
    return sessionStorage.getItem(QUEUE_KEY) === "1";
  } catch {
    return false;
  }
}

function clearWelcomeQueue(): void {
  try { sessionStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
}

type View = "main" | "full";

function Video({ src, title, onEnded, onMissing }: {
  src: string; title: string; onEnded?: () => void; onMissing: () => void;
}) {
  return (
    <div className="wl-video">
      {/* A missing file (or the dev server's HTML fallback) fails to load, which shows the steps instead. */}
      <video key={src} src={src} controls playsInline preload="metadata" aria-label={title}
        onEnded={onEnded} onError={onMissing} />
    </div>
  );
}

export function WelcomeModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { lang, t } = useLanguage();
  const w = t.dashboard.welcome;
  const navigate = useNavigate();
  const [view, setView] = useState<View>("main");
  const [missing, setMissing] = useState<Record<View, boolean>>({ main: false, full: false });
  const [fullAllowed, setFullAllowed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);

  // Whether this student may take the full syllabus quiz (exam year), as the server decides.
  useEffect(() => {
    let live = true;
    quizzesApi.subjects(lang).then((r) => live && setFullAllowed(r.full_quiz.allowed), () => undefined);
    return () => { live = false; };
  }, [lang]);

  useEffect(() => {
    clearWelcomeQueue();                      // shown once per login: a reload won't bring it back
    const opener = document.activeElement as HTMLElement | null;
    goRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; opener?.focus(); };
  }, []);

  const finish = (to?: string) => {
    onClose();
    if (to) navigate(to);
  };

  // After the main video ends: a short countdown, then the dashboard (the student can stay).
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { finish("/dashboard"); return; }
    const id = window.setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); finish(); return; }
    if (e.key !== "Tab") return;
    const items = boxRef.current?.querySelectorAll<HTMLElement>("button, a[href], input, video[controls]");
    if (!items?.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const name = user.full_name.trim().split(" ")[0];
  const showSteps = view === "main" && missing.main;

  return createPortal(
    <div className="wl-scrim" onClick={() => finish()}>
      <div ref={boxRef} className="wl-modal" role="dialog" aria-modal="true" aria-labelledby="wl-title"
        onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <button type="button" className="wl-close" aria-label={w.close} onClick={() => finish()}>{icons.cross}</button>
        <img className="wl-bear" src="/dashboard/bear-cheer.png" alt="" aria-hidden="true" />

        <div className="wl-body">
          <p className="wl-hello">{fill(w.hello, { name })}</p>
          <h2 id="wl-title">{w.title}</h2>
          <p className="wl-sub">{w.subtitle}</p>

          {view === "full" ? (
            <>
              <h3 className="wl-video-title">{w.fullVideoTitle}</h3>
              {missing.full ? <p className="wl-soon">{w.fullSoon}</p>
                : <Video src={WELCOME_VIDEOS.full} title={w.fullVideoTitle}
                    onMissing={() => setMissing((m) => ({ ...m, full: true }))} />}
              <button type="button" className="wl-link" onClick={() => setView("main")}>{icons.arrowLeft}{w.backToMain}</button>
            </>
          ) : showSteps ? (
            <>
              <p className="wl-soon">{w.videoSoon}</p>
              <ol className="wl-steps">
                {w.steps.map((s, i) => (
                  <li key={s.title}>
                    <span className="wl-num" aria-hidden="true">{i + 1}</span>
                    <span className="wl-step-icon" aria-hidden="true">{[icons.chat, icons.pencil, icons.flame][i]}</span>
                    <span><strong>{s.title}</strong><small>{s.text}</small></span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h3 className="wl-video-title">{w.videoTitle}</h3>
              <Video src={WELCOME_VIDEOS.main} title={w.videoTitle}
                onEnded={() => setCountdown(REDIRECT_SECONDS)}
                onMissing={() => setMissing((m) => ({ ...m, main: true }))} />
            </>
          )}

          {fullAllowed && view === "main" && (
            <div className="wl-full">
              <span className="wl-full-icon" aria-hidden="true">{icons.target}</span>
              <span className="wl-full-copy"><strong>{w.fullTitle}</strong><small>{w.fullText}</small></span>
              <button type="button" className="db-btn-outline db-btn-sm" onClick={() => setView("full")}>
                {icons.play}{w.fullWatch}
              </button>
            </div>
          )}

          {countdown !== null && (
            <p className="wl-redirect" role="status">
              {fill(w.redirect, { n: countdown })}{" "}
              <button type="button" className="wl-link" onClick={() => setCountdown(null)}>{w.stay}</button>
            </p>
          )}

          <div className="wl-actions">
            <button ref={goRef} type="button" className="db-btn-primary wl-go" onClick={() => finish("/dashboard")}>
              {w.go} {icons.arrowRight}
            </button>
            <button type="button" className="wl-skip" onClick={() => finish("/dashboard")}>{w.skip}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
