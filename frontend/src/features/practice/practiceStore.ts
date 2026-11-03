// The current practice set and saved questions live in this browser (localStorage, per
// user) until the backend has practice_attempts / saved_questions tables.
// Every read/write is guarded: private windows can throw.
import type { Medium, QuizQuestion } from "../../services/api";

/** How far the student got on one question. */
export interface QuestionProgress {
  solved: number;        // guided steps answered correctly (0..steps.length)
  hints: number;         // step titles revealed with "Hint"
  revealed: boolean;     // pressed "Show answer"
}

export interface PracticeSet {
  createdAt: number;
  lang: Medium;
  questions: QuizQuestion[];   // step options already shuffled
  current: number;             // index into questions
  progress: QuestionProgress[];
}

export interface SavedQuestion {
  id: string;            // question text, so saving twice is a no-op
  topic: string;
  question: string;
  answer: string;
  savedAt: number;
}

const setKey = (userId: number) => `kelu.practice.v1.${userId}`;
const savedKey = (userId: number) => `kelu.saved.v1.${userId}`;

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

export const loadSet = (userId: number) => read<PracticeSet | null>(setKey(userId), null);
export const saveSet = (userId: number, set: PracticeSet | null) => write(setKey(userId), set);
export const loadSaved = (userId: number) => read<SavedQuestion[]>(savedKey(userId), []);
export const saveSaved = (userId: number, list: SavedQuestion[]) => write(savedKey(userId), list);

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh set from the API: options shuffled once, so a reload doesn't move them. */
export function newSet(questions: QuizQuestion[], lang: Medium): PracticeSet {
  return {
    createdAt: Date.now(),
    lang,
    current: 0,
    questions: questions.map((q) => ({ ...q, steps: q.steps.map((s) => ({ ...s, options: shuffle(s.options) })) })),
    progress: questions.map(() => ({ solved: 0, hints: 0, revealed: false })),
  };
}

export const isDone = (q: QuizQuestion, p: QuestionProgress) =>
  p.revealed || (q.steps.length > 0 && p.solved >= q.steps.length);
