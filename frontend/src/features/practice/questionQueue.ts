import type { QuizQuestion } from "../../services/api";

// AI requests for practice questions, kept for the whole browser session instead of inside the
// Practice page. Every request is a real AI call on the student's daily quota, so:
//  - a question is asked for at most once per session, even if the page closes and reopens;
//  - a request still running when the student opens another page keeps going, and its result
//    waits here until Practice is open again (before, it was thrown away and asked for again).
// A full browser reload starts a new session, so unfinished questions are asked for again then.

export type Outcome = { ok: true; question: QuizQuestion } | { ok: false; error: unknown };

const asked = new Set<string>();                 // never ask for these again this session
const running = new Map<string, Promise<void>>();
const waiting = new Map<string, Outcome>();      // finished while Practice was closed
let listener: ((key: string, outcome: Outcome) => void) | null = null;

/** Has this question been asked for already (running, finished, or waiting to be shown)? */
export const wasAsked = (key: string) => asked.has(key);

/** AI requests running right now, across every quiz. */
export const runningCount = () => running.size;

export function ask(key: string, fetch: () => Promise<QuizQuestion>): void {
  if (asked.has(key)) return;
  asked.add(key);
  const job = fetch()
    .then((question): Outcome => ({ ok: true, question }), (error): Outcome => ({ ok: false, error }))
    .then((outcome) => {
      running.delete(key);
      if (listener) listener(key, outcome);
      else waiting.set(key, outcome);
    });
  running.set(key, job);
}

/** The open Practice page receives results here, including any that finished while it was
 *  closed. Returns the unsubscribe function. */
export function listen(fn: (key: string, outcome: Outcome) => void): () => void {
  listener = fn;
  for (const [key, outcome] of waiting) {
    waiting.delete(key);
    fn(key, outcome);
  }
  return () => { if (listener === fn) listener = null; };
}
