// Tutor chats are kept on the server (tutor_conversations, see useChatSync.ts); this browser
// copy (localStorage, per user) is a cache so the page opens instantly and works offline.
// Every read/write is guarded: private windows can throw.
import type { TutorSource } from "../../services/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;                 // epoch ms
  sources?: TutorSource[];
  hintLevel?: number;         // assistant replies: the level the reply was written at
  error?: string;             // assistant placeholder for a failed reply: the error code
  image?: string;             // user message: thumbnail of an attached photo (the full image isn't kept)
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  saved: boolean;
  hintLevel: number;          // 0 nudge .. 3 worked step; "next hint" raises it
  messages: Message[];
}

export type Group = "today" | "yesterday" | "week" | "older";
export const GROUP_ORDER: Group[] = ["today", "yesterday", "week", "older"];
export const MAX_HINT_LEVEL = 3;
export const DAILY_LIMIT = 20;

const key = (userId: number) => `kelu.tutor.v1.${userId}`;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function loadConversations(userId: number): Conversation[] {
  try {
    const raw = localStorage.getItem(key(userId));
    const list = raw ? (JSON.parse(raw) as Conversation[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveConversations(userId: number, list: Conversation[]): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(list));
  } catch {
    // Storage full or blocked: the chat still works for this visit, it just won't be kept.
  }
}

export function titleFrom(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

/** Messages the student sent since local midnight, across all chats. */
export function sentToday(list: Conversation[], now = new Date()): number {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return list.reduce((n, c) => n + c.messages.filter((m) => m.role === "user" && m.at >= midnight).length, 0);
}

/** Which sidebar heading a chat last touched at `ts` goes under. */
export function groupFor(ts: number, now = new Date()): Group {
  const DAY = 86_400_000;
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  if (ts >= midnight) return "today";
  if (ts >= midnight - DAY) return "yesterday";
  if (ts >= midnight - 6 * DAY) return "week";
  return "older";
}
