// The current practice set lives in this browser (localStorage, per user). A finished set is
// also saved to the server (practice_answers), for the progress report. Saved questions are on
// the server (savedApi); a list left here by an older version is uploaded once and cleared.
// Every read/write is guarded: private windows can throw.
import type { AttemptAnswer, Medium, QuizQuestion } from "../../services/api";

/** The student's answers to one question: the option index picked at each step (null = not
 *  answered). `checked`: a subject quiz shows the answer and reasons straight after each question,
 *  which locks its picks. The whole-syllabus quiz is exam style: nothing shows until the end. */
export interface QuestionProgress {
  picks: (number | null)[];
  checked?: boolean;
}

export interface PracticeSet {
  createdAt: number;           // also the set's id: late answers for a replaced set are ignored
  lang: Medium;
  topic: string;               // the subject's key; "" for no quiz yet or the whole-syllabus quiz
  full: boolean;               // the stored 10-question whole-syllabus quiz
  questions: QuizQuestion[];   // in order, easiest first; step options already shuffled
  held: QuizQuestion[];        // written early: waits here until the easier questions are ready
  current: number;             // index into questions; == questions.length while the next one is written
  progress: QuestionProgress[];
  todo: number[];              // places (1..10) not written yet; a reload asks for them again
  failed: number;              // slots the AI could not write, even after its retry
  submittedAt: number | null;  // "Finish quiz" pressed: answers are locked and the results shown
  recorded: boolean;           // the server has this set's answers (or there were none to send)
}

/** Saved before saving moved to the server: read once, uploaded, then cleared. */
export interface LocalSavedQuestion {
  id: string;            // question text, so saving twice is a no-op
  topic: string;
  question: string;
  answer: string;
  savedAt: number;
}

const setKey = (userId: number) => `kelu.practice.v1.${userId}`;
const savedKey = (userId: number) => `kelu.saved.v1.${userId}`;
const seenKey = (userId: number) => `kelu.practice.seen.v1.${userId}`;   // stored questions already served
const SEEN_MAX = 300;                       // older questions may come round again

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: practice still works for this visit, it just isn't kept.
  }
}

// Older saved sets: progress from the old guided mode (solved/hints) has no picks, so those
// questions start unanswered. A set from before subjects has nothing left to write.
const upgrade = (s: PracticeSet | null): PracticeSet | null => s && {
  ...s, todo: s.topic ? s.todo ?? [] : [], topic: s.topic ?? "", full: s.full ?? false, held: s.held ?? [], failed: s.failed ?? 0,
  submittedAt: s.submittedAt ?? null, recorded: s.recorded ?? false,
  progress: s.questions.map((q, i) => s.progress[i]?.picks ? s.progress[i] : { picks: q.steps.map(() => null) }),
};

/** Stored questions this student has been served, newest last (sent so the next quiz differs). */
export const loadSeen = (userId: number) => read<number[]>(seenKey(userId), []);
export function markSeen(userId: number, ids: (number | null | undefined)[]): void {
  const fresh = ids.filter((i): i is number => typeof i === "number");
  if (!fresh.length) return;
  const list = loadSeen(userId).filter((i) => !fresh.includes(i));
  write(seenKey(userId), [...list, ...fresh].slice(-SEEN_MAX));
}

const loadSet = (userId: number) => upgrade(read<PracticeSet | null>(setKey(userId), null));

/** Every quiz under way, one per topic (the whole-syllabus quiz under FULL_KEY), so a student
 *  can start a topic, browse while it's written, and start another. */
export type PracticeSets = Record<string, PracticeSet>;
export const FULL_KEY = "__full";
export const keyOf = (set: PracticeSet) => (set.full ? FULL_KEY : set.topic);
const setsKey = (userId: number) => `kelu.practice.v2.${userId}`;

export function loadSets(userId: number): PracticeSets {
  const stored = read<PracticeSets | null>(setsKey(userId), null);
  if (stored) {
    return Object.fromEntries(Object.entries(stored).flatMap(([key, s]) => {
      const set = upgrade(s);
      return set ? [[key, set]] : [];
    }));
  }
  const old = loadSet(userId);       // saved before several quizzes could run at once
  return old && (old.topic || old.full) ? { [keyOf(old)]: old } : {};
}
export const saveSets = (userId: number, sets: PracticeSets) => write(setsKey(userId), sets);

/** What a topic's tile says about its quiz; null: no quiz to show (start a new one). */
export interface QuizState {
  state: "writing" | "ready" | "answering" | "done";
  ready: number;                     // questions the student can open now
  total: number;
  answered: number;
  pct: number;                       // the score, once finished
}

export function quizState(set: PracticeSet | undefined): QuizState | null {
  if (!set) return null;
  const ready = set.questions.length;
  const total = ready + set.held.length + set.todo.length;
  if (!total) return null;           // nothing could be written: start again
  const answered = set.questions.filter((q, i) => isDone(q, set.progress[i])).length;
  const state = set.submittedAt !== null ? "done" : answered ? "answering" : ready ? "ready" : "writing";
  return { state, ready, total, answered, pct: score(set).pct };
}
export const loadLocalSaved = (userId: number) => read<LocalSavedQuestion[]>(savedKey(userId), []);
export const clearLocalSaved = (userId: number) => {
  try {
    localStorage.removeItem(savedKey(userId));
  } catch {
    /* storage blocked: the import is repeat-safe, so a second upload adds nothing */
  }
};

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const QUIZ_SLOTS = 5;

/** No quiz yet: nothing is requested until the student picks a subject. */
export const blankSet = (lang: Medium): PracticeSet => ({ ...emptySet(lang, ""), todo: [] });

/** A new quiz on one subject: its questions are written one by one (see the queue in PracticePage). */
export function emptySet(lang: Medium, topic: string): PracticeSet {
  return {
    createdAt: Date.now(),
    lang,
    topic,
    full: false,
    current: 0,
    questions: [],
    held: [],
    progress: [],
    todo: Array.from({ length: QUIZ_SLOTS }, (_, i) => i + 1),
    failed: 0,
    submittedAt: null,
    recorded: false,
  };
}

/** The whole-syllabus quiz: complete from the start, as its questions are stored. */
export function fullSet(lang: Medium, questions: QuizQuestion[]): PracticeSet {
  const set = { ...emptySet(lang, ""), full: true, todo: questions.map((q) => q.number) };
  return questions.reduce((s, q) => addQuestion(s, q.number, q), set);
}

/** Questions are written at once and can finish in any order, so one is shown only when every
 *  easier question has arrived or failed: the student always climbs from easiest to hardest. */
function release(set: PracticeSet): PracticeSet {
  const next = set.todo.length ? Math.min(...set.todo) : Infinity;
  const ready = set.held.filter((q) => q.number < next).sort((a, b) => a.number - b.number);
  if (!ready.length) return set;
  return {
    ...set,
    held: set.held.filter((q) => q.number >= next),
    questions: [...set.questions, ...ready],
    progress: [...set.progress, ...ready.map((q) => ({ picks: q.steps.map(() => null) }))],
  };
}

/** A question arrived for `slot`: options shuffled once, so a reload doesn't move them. */
export function addQuestion(set: PracticeSet, slot: number, q: QuizQuestion): PracticeSet {
  if (!set.todo.includes(slot)) return set;            // already written (a duplicate request)
  return release({
    ...set,
    todo: set.todo.filter((s) => s !== slot),
    held: [...set.held, { ...q, number: slot, steps: q.steps.map((s) => ({ ...s, options: shuffle(s.options) })) }],
  });
}

/** The AI gave up on `slot` (or `all` remaining slots, e.g. nothing indexed). */
export function failSlot(set: PracticeSet, slot: number | "all"): PracticeSet {
  const gone = slot === "all" ? set.todo.length : set.todo.includes(slot) ? 1 : 0;
  return release({ ...set, todo: slot === "all" ? [] : set.todo.filter((s) => s !== slot), failed: set.failed + gone });
}

/** Every step of the question has an answer picked (right or wrong). */
export const isDone = (q: QuizQuestion, p: QuestionProgress) =>
  q.steps.length === 0 || p.picks.every((x) => x !== null);

export const answeredSteps = (p: QuestionProgress) => p.picks.filter((x) => x !== null).length;

/** Was step `i` answered with the correct option? (Unanswered counts as wrong.) */
export const stepRight = (q: QuizQuestion, p: QuestionProgress, i: number) => {
  const pick = p.picks[i];
  return pick !== null && pick !== undefined && !!q.steps[i]?.options[pick]?.correct;
};

/** What a submitted set adds to the progress report. A question left completely blank isn't
 *  evidence either way, so it's left out; a part-answered one counts its blank steps as wrong,
 *  as the results screen does. Questions with no steps have nothing to mark. */
export function attemptAnswers(set: PracticeSet): AttemptAnswer[] {
  return set.questions.flatMap((q, i) => {
    const p = set.progress[i];
    if (!q.steps.length || !answeredSteps(p)) return [];
    return [{
      slot: q.number, topic: q.topic, steps_total: q.steps.length,
      steps_right: q.steps.filter((_, j) => stepRight(q, p, j)).length,
    }];
  });
}

/** Results of a set: steps right out of all steps, and questions with every step right. */
export function score(set: PracticeSet) {
  let steps = 0, right = 0, perfect = 0;
  set.questions.forEach((q, i) => {
    const r = q.steps.filter((_, j) => stepRight(q, set.progress[i], j)).length;
    steps += q.steps.length;
    right += r;
    if (q.steps.length && r === q.steps.length) perfect += 1;
  });
  return { steps, right, perfect, questions: set.questions.length, pct: steps ? Math.round((100 * right) / steps) : 0 };
}
