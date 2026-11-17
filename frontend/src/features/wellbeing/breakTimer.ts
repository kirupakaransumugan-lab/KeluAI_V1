// Eye-and-mind breaks: after 20 minutes of study on Practice or the AI tutor, the student takes
// a short break (a calm green scene or a tiny game) before carrying on. The 20 minutes add up
// across both pages, so switching between them doesn't reset it, and they survive a reload
// (sessionStorage: a new visit starts fresh). Every read/write is guarded: private windows throw.

export const BREAK_EVERY_MS = 20 * 60 * 1000;
export const IDLE_AFTER_MS = 2 * 60 * 1000;     // no key, click, scroll or touch for this long: away
const KEY = "kelu.break.v1";

export function loadStudied(): number {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveStudied(ms: number): void {
  try {
    sessionStorage.setItem(KEY, String(Math.round(ms)));
  } catch {
    /* storage blocked: the count just lives in memory for this page */
  }
}

/** Does this tick count as study time?
 *  @param visible  the browser tab is on screen (document.visibilityState === "visible")
 *  @param idleMs   time since the student last pressed a key, clicked, scrolled or touched */
export function countsAsActive(visible: boolean, idleMs: number): boolean {
  // TODO(human): decide what counts as "studying" for the 20-minute break clock.
  return true;
}

// A running whole-syllabus quiz holds breaks off: its 50-minute exam clock doesn't stop.
let held = false;
const holdListeners = new Set<() => void>();
export const breaksHeld = () => held;
export function holdBreaks(on: boolean): void {
  if (held === on) return;
  held = on;
  holdListeners.forEach((fn) => fn());
}
export function onHoldChange(fn: () => void): () => void {
  holdListeners.add(fn);
  return () => { holdListeners.delete(fn); };
}
