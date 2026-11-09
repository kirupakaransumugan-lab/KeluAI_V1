import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, chatsApi, type ServerChat } from "../../services/api";
import type { Conversation, Message } from "./conversations";

// Keeps the tutor chats on the server (GET/PUT/DELETE /tutor/conversations), so chats and saved
// chats follow the student to any device. The browser copy (conversations.ts) stays as a cache:
// the page opens from it instantly, then this merges in the server's copy and pushes changes.
//
// Deletions: the ids this browser has synced are remembered. A synced chat missing from the
// server was deleted on another device, so it is dropped here, not uploaded again.

const PUSH_DELAY_MS = 1200;
const syncedKey = (userId: number) => `kelu.tutor.synced.v1.${userId}`;

function loadSynced(userId: number): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(syncedKey(userId)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSynced(userId: number, ids: Set<string>): void {
  try {
    localStorage.setItem(syncedKey(userId), JSON.stringify([...ids]));
  } catch {
    /* storage blocked: deletions on other devices may come back once; nothing is lost */
  }
}

const fromServer = (c: ServerChat): Conversation => ({
  id: c.id, title: c.title, saved: c.saved, hintLevel: c.hint_level,
  messages: c.messages as Message[], createdAt: c.created_ms, updatedAt: c.updated_ms,
});

const toServer = (c: Conversation): Omit<ServerChat, "id"> => ({
  title: c.title || "Chat", saved: c.saved, hint_level: c.hintLevel, messages: c.messages,
  created_ms: c.createdAt, updated_ms: c.updatedAt,
});

/** Cheap "has this chat changed since it was last synced" key. */
const fingerprint = (c: Conversation) => `${c.updatedAt}|${c.saved}|${c.hintLevel}|${c.messages.length}|${c.title}`;

/** The server's chats plus this browser's: newer edit wins, chats deleted elsewhere are dropped,
 *  chats only this browser has (new, or from before syncing existed) are kept for upload. */
export function mergeChats(local: Conversation[], server: Conversation[], syncedBefore: Set<string>): Conversation[] {
  const byId = new Map(server.map((c) => [c.id, c]));
  for (const c of local) {
    const theirs = byId.get(c.id);
    if (theirs) {
      if (c.updatedAt > theirs.updatedAt) byId.set(c.id, c);
    } else if (!syncedBefore.has(c.id)) {
      byId.set(c.id, c);
    }
  }
  return [...byId.values()];
}

export function useChatSync(userId: number, chats: Conversation[],
  setChats: Dispatch<SetStateAction<Conversation[]>>): void {
  const navigate = useNavigate();
  const ready = useRef(false);                       // the server's copy has been merged in
  const pushed = useRef(new Map<string, string>());  // chat id -> fingerprint the server has
  const synced = useRef(loadSynced(userId));

  // 1. Merge in the server's chats once.
  useEffect(() => {
    let cancelled = false;
    chatsApi.list().then(({ conversations }) => {
      if (cancelled) return;
      const server = conversations.map(fromServer);
      for (const c of server) pushed.current.set(c.id, fingerprint(c));
      setChats((local) => mergeChats(local, server, synced.current));
      synced.current = new Set(server.map((c) => c.id));
      saveSynced(userId, synced.current);
      ready.current = true;
    }, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      // Offline or server down: keep working from the browser copy; the next visit syncs.
    });
    return () => { cancelled = true; };
  }, [userId, setChats, navigate]);

  // 2. Push what changed, shortly after it changed: new or edited chats, and deleted ones.
  useEffect(() => {
    if (!ready.current) return;
    const timer = window.setTimeout(async () => {
      const current = new Set(chats.map((c) => c.id));
      const changed = chats.filter((c) => c.messages.length > 0 && pushed.current.get(c.id) !== fingerprint(c));
      const removed = [...pushed.current.keys()].filter((id) => !current.has(id));

      for (const c of changed) {
        try {
          const stored = fromServer(await chatsApi.save(toServer(c), c.id));
          pushed.current.set(c.id, fingerprint(stored));
          synced.current.add(c.id);
          // Another device had a newer copy: show that one.
          if (stored.updatedAt > c.updatedAt) setChats((list) => list.map((x) => (x.id === c.id ? stored : x)));
        } catch {
          /* tried again on the next change or visit */
        }
      }
      for (const id of removed) {
        try {
          await chatsApi.remove(id);
          pushed.current.delete(id);
          synced.current.delete(id);
        } catch {
          /* tried again on the next change */
        }
      }
      if (changed.length || removed.length) saveSynced(userId, synced.current);
    }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [chats, userId, setChats]);
}
