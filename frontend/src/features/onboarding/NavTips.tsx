import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../app/providers";
import type { DashboardCopy } from "../../utils/i18n";
import "../../styles/nav-tips.css";

// Rich hover cards on the sidebar links, like the tool tips in design apps: rest the pointer on
// "Practice" and a small card slides out with a short looping video of how it works.
//
// Videos live in public/tips/<key>.mp4 (muted, a few seconds, 16:9). A link without its video
// yet shows its three steps as an animated walkthrough instead, so every card is useful now.
// Only devices with a real mouse get cards; keyboard users get them on focus too.

export type TipKey = keyof DashboardCopy["tips"]["items"];

const VIDEO: Partial<Record<TipKey, string>> = {
  home: "/onboarding/KELU_Browser_Intro_16x9.mp4",
  practice: "/tips/practice.mp4",
  tutor: "/tips/tutor.mp4",
  pastPapers: "/tips/past-papers.mp4",
  progress: "/tips/progress.mp4",
  subscription: "/tips/subscription.mp4",
  settings: "/tips/settings.mp4",
};
const OPEN_DELAY = 450;           // long enough that sweeping past the menu doesn't pop cards
const SWITCH_DELAY = 120;         // once one card is open, moving to the next link is quick
const CLOSE_DELAY = 160;          // time to move the pointer from the link into the card
const CARD_WIDTH = 320;
const STEP_MS = 1700;

/** Videos that failed to load, so the next hover goes straight to the walkthrough. */
const missing = new Set<string>();

interface Open { key: TipKey; label: string; icon: ReactNode; anchor: DOMRect }

function canHover(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The three steps, highlighted one after another, with a progress line under the active one. */
function Walkthrough({ icon, steps }: { icon: ReactNode; steps: [string, string, string] }) {
  const still = reducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % steps.length), STEP_MS);
    return () => window.clearInterval(t);
  }, [still, steps.length]);
  return (
    <div className="nt-walk" style={{ ["--nt-step-ms" as string]: `${STEP_MS}ms` }}>
      <span className="nt-walk-icon" aria-hidden="true">{icon}</span>
      <ol>
        {steps.map((s, i) => (
          <li key={s} className={still || i === active ? "on" : i < active ? "done" : ""}>
            <span className="nt-walk-num">{i + 1}</span>
            <span className="nt-walk-text">{s}</span>
            {!still && i === active && <span className="nt-walk-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TipCard({ open, onEnter, onLeave }: { open: Open; onEnter: () => void; onLeave: () => void }) {
  const { t } = useLanguage();
  const copy = t.dashboard.tips;
  const item = copy.items[open.key];
  const src = VIDEO[open.key];
  const [videoOk, setVideoOk] = useState<boolean | null>(src && !missing.has(src) && !reducedMotion() ? null : false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number }>();

  useEffect(() => {
    setVideoOk(src && !missing.has(src) && !reducedMotion() ? null : false);
  }, [src]);

  // Beside the link, vertically centred on it, kept inside the window.
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const a = open.anchor;
    const h = card.offsetHeight;
    const centre = a.top + a.height / 2;
    const top = Math.min(Math.max(12, centre - h / 2), window.innerHeight - h - 12);
    const left = Math.min(a.right + 14, window.innerWidth - CARD_WIDTH - 12);
    setPos({ top, left, arrow: Math.min(Math.max(18, centre - top), h - 18) });
  }, [open, videoOk]);

  return (
    <div ref={ref} id="nt-card" role="tooltip" className={`nt-card${pos ? " in" : ""}`}
      style={pos ? { top: pos.top, left: pos.left, ["--nt-arrow" as string]: `${pos.arrow}px` } : { visibility: "hidden" }}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="nt-media">
        {videoOk !== false && src && (
          <video key={src} src={src} muted autoPlay loop playsInline preload="auto" aria-hidden="true"
            className={videoOk ? "ready" : ""}
            onLoadedData={() => setVideoOk(true)}
            onError={() => { missing.add(src); setVideoOk(false); }} />
        )}
        {videoOk !== true && <Walkthrough icon={open.icon} steps={item.steps} />}
      </div>
      <div className="nt-body">
        <span className="nt-label">{copy.label}</span>
        <strong>{open.label}</strong>
        <p>{item.text}</p>
      </div>
    </div>
  );
}

/** `bind(key, label, icon)` goes on each link; render `card` once anywhere in the layout. */
export function useNavTips() {
  const [open, setOpen] = useState<Open | null>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const isOpen = useRef(false);
  isOpen.current = open !== null;

  const clear = () => { window.clearTimeout(openTimer.current); window.clearTimeout(closeTimer.current); };
  const close = useCallback(() => { clear(); setOpen(null); }, []);
  const closeSoon = () => {
    window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
  };
  const keep = () => window.clearTimeout(closeTimer.current);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onAway = () => close();             // a fixed card would drift from its link
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onAway, true);
    window.addEventListener("resize", onAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onAway, true);
      window.removeEventListener("resize", onAway);
    };
  }, [open, close]);
  useEffect(() => clear, []);

  const bind = (key: TipKey, label: string, icon: ReactNode) => ({
    "aria-describedby": open?.key === key ? "nt-card" : undefined,
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      if (!canHover()) return;
      clear();
      const anchor = e.currentTarget.getBoundingClientRect();
      openTimer.current = window.setTimeout(() => setOpen({ key, label, icon, anchor }),
        isOpen.current ? SWITCH_DELAY : OPEN_DELAY);
    },
    onMouseLeave: closeSoon,
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.matches(":focus-visible")) return;     // keyboard only, not clicks
      clear();
      setOpen({ key, label, icon, anchor: e.currentTarget.getBoundingClientRect() });
    },
    onBlur: closeSoon,
    onClick: close,
  });

  const card = open ? createPortal(<TipCard open={open} onEnter={keep} onLeave={closeSoon} />, document.body) : null;
  return { bind, card };
}
