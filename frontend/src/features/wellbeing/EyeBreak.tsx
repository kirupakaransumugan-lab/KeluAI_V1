import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../app/providers";
import { fill } from "../../utils/dates";
import {
  BREAK_EVERY_MS, breaksHeld, countsAsActive, loadStudied, onHoldChange, saveStudied,
} from "./breakTimer";
import "../../styles/wellbeing.css";

// Every 20 minutes of study on Practice or the tutor, a break card covers the page. The student
// picks a calm green scene (look into the distance for 20 seconds: the 20-20-20 rule for eye
// strain) or a 30-second bubble game, and carries on once it's done. There is no skip: the
// break is the point. It never interrupts the timed whole-syllabus quiz (see holdBreaks).

const TICK_MS = 5000;
const SCENE_S = 20;
const GAME_S = 30;

/** Counts study time while `enabled` (the student is on Practice or the tutor); true once a break is due. */
function useBreakDue(enabled: boolean) {
  const [due, setDue] = useState(false);
  const lastInput = useRef(Date.now());

  useEffect(() => {
    const seen = () => { lastInput.current = Date.now(); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, seen, { passive: true, capture: true }));
    return () => events.forEach((e) => window.removeEventListener(e, seen, { capture: true }));
  }, []);

  useEffect(() => {
    if (!enabled || due) return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const step = Math.min(now - last, TICK_MS * 2);     // a sleeping laptop doesn't count
      last = now;
      if (!countsAsActive(document.visibilityState === "visible", now - lastInput.current)) return;
      const studied = loadStudied() + step;
      saveStudied(studied);
      if (studied >= BREAK_EVERY_MS && !breaksHeld()) setDue(true);
    };
    const id = window.setInterval(tick, TICK_MS);
    // A held break that was already due shows as soon as the quiz ends.
    const off = onHoldChange(() => { if (!breaksHeld() && loadStudied() >= BREAK_EVERY_MS) setDue(true); });
    return () => { window.clearInterval(id); off(); };
  }, [enabled, due]);

  const finish = () => {
    saveStudied(0);
    lastInput.current = Date.now();
    setDue(false);
  };
  return { due: enabled && due, finish };
}

/** Counts down from `seconds` once started; returns seconds left. */
function useCountdown(seconds: number, running: boolean) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!running) return;
    setLeft(seconds);
    const end = Date.now() + seconds * 1000;
    const id = window.setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    return () => window.clearInterval(id);
  }, [seconds, running]);
  return left;
}

function GreenScene() {
  return (
    <svg className="wb-scene" viewBox="0 0 600 300" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6f5" /><stop offset="1" stopColor="#eaf7ee" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#wb-sky)" />
      <circle cx="480" cy="70" r="30" fill="#ffe9a8" className="wb-sun" />
      <g className="wb-cloud" fill="#ffffff" opacity="0.9">
        <ellipse cx="120" cy="60" rx="46" ry="15" /><ellipse cx="150" cy="50" rx="30" ry="14" />
      </g>
      <g className="wb-cloud slow" fill="#ffffff" opacity="0.75">
        <ellipse cx="330" cy="95" rx="40" ry="12" /><ellipse cx="355" cy="86" rx="24" ry="11" />
      </g>
      <path d="M0 190 Q120 130 250 175 T600 160 V300 H0z" fill="#9fd8a6" />
      <path d="M0 220 Q160 170 320 210 T600 200 V300 H0z" fill="#6fbf7d" />
      {[70, 210, 430, 540].map((x, i) => (
        <g key={x} className="wb-tree" style={{ animationDelay: `${i * -1.3}s`, transformOrigin: `${x}px 240px` }}>
          <rect x={x - 4} y="205" width="8" height="38" fill="#7a5a3a" rx="2" />
          <circle cx={x} cy="195" r="26" fill="#3f9a57" /><circle cx={x - 14} cy="208" r="16" fill="#4fae66" />
          <circle cx={x + 15} cy="207" r="17" fill="#4fae66" />
        </g>
      ))}
      <path d="M0 255 Q150 225 300 250 T600 245 V300 H0z" fill="#4fa865" />
      <g className="wb-flutter"><path d="M0 0 q-6 -8 -10 0 q4 6 10 0 q6 -8 10 0 q-4 6 -10 0z" fill="#f5b6d2" /></g>
    </svg>
  );
}

interface Bubble { id: number; x: number; size: number; dur: number }

function BubbleGame({ onScore }: { onScore: (n: number) => void }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const next = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      next.current += 1;
      const b = { id: next.current, x: 6 + Math.random() * 82, size: 36 + Math.random() * 30, dur: 4 + Math.random() * 3 };
      setBubbles((all) => [...all.slice(-14), b]);
    }, 650);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => onScore(score), [score, onScore]);
  const pop = (id: number) => {
    setBubbles((all) => all.filter((b) => b.id !== id));
    setScore((n) => n + 1);
  };
  return (
    <div className="wb-game">
      {bubbles.map((b) => (
        <button key={b.id} type="button" className="wb-bubble" aria-label="Pop"
          style={{ left: `${b.x}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s` }}
          onPointerDown={() => pop(b.id)}
          onAnimationEnd={() => setBubbles((all) => all.filter((x) => x.id !== b.id))} />
      ))}
    </div>
  );
}

export function EyeBreak({ enabled }: { enabled: boolean }) {
  const { t } = useLanguage();
  const w = t.dashboard.wellbeing;
  const { due, finish } = useBreakDue(enabled);
  const [mode, setMode] = useState<"choose" | "scene" | "game">("choose");
  const [popped, setPopped] = useState(0);
  const left = useCountdown(mode === "game" ? GAME_S : SCENE_S, mode !== "choose");
  const over = mode !== "choose" && left === 0;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!due) return;
    setMode("choose");
    setPopped(0);
    cardRef.current?.focus();
  }, [due]);

  if (!due) return null;

  const back = () => { setMode("choose"); finish(); };

  return (
    <div className="wb-scrim">
      <div className="wb-card" role="dialog" aria-modal="true" aria-labelledby="wb-title" tabIndex={-1} ref={cardRef}>
        {mode === "choose" ? (
          <>
            <GreenScene />
            <h2 id="wb-title">{w.title}</h2>
            <p>{w.text}</p>
            <div className="wb-choices">
              <button type="button" className="wb-btn" onClick={() => setMode("scene")}>{w.scene}</button>
              <button type="button" className="wb-btn ghost" onClick={() => setMode("game")}>{w.game}</button>
            </div>
          </>
        ) : (
          <>
            <div className="wb-stage">
              {mode === "scene" ? <GreenScene /> : <><GreenScene />{!over && <BubbleGame onScore={setPopped} />}</>}
              {!over && <span className="wb-count" role="timer">{left}s</span>}
            </div>
            <h2 id="wb-title">{over ? w.doneTitle : mode === "scene" ? w.sceneTitle : w.gameTitle}</h2>
            <p role="status">
              {over ? (mode === "game" ? fill(w.gameScore, { n: popped }) : w.doneText)
                : mode === "scene" ? w.sceneText : fill(w.gameText, { n: popped })}
            </p>
            {over && <button type="button" className="wb-btn" onClick={back}>{w.back}</button>}
          </>
        )}
      </div>
    </div>
  );
}
