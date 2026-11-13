import { useEffect, useSyncExternalStore } from "react";
import { authApi, type User } from "../services/api";

// Who is signed in, for the public pages (landing top bar and its buttons). One shared value,
// so the navbar and every "Start free trial" button agree and the page asks the server once.
//
// undefined = not known yet (render the guest view, so nothing jumps for real guests),
// null = a guest, User = signed in. The signed-in pages keep it up to date too: the dashboard
// fills it after /auth/me, and logging out empties it.

let current: User | null | undefined;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function setSession(user: User | null): void {
  current = user;
  listeners.forEach((l) => l());
}

/** Ask the server again (once at a time). Errors count as "not signed in". */
export function refreshSession(): Promise<void> {
  pending ??= authApi.session()
    .then((r) => setSession(r.user), () => setSession(null))
    .finally(() => { pending = null; });
  return pending;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The signed-in user. Pass `refresh` from one component per page (the navbar) to check the
 *  server when the page opens; the others just read the shared value. */
export function useSession(refresh = false): User | null | undefined {
  const user = useSyncExternalStore(subscribe, () => current, () => undefined);
  useEffect(() => { if (refresh) void refreshSession(); }, [refresh]);
  return user;
}

/** Where a signed-in person's "dashboard" is. */
export const homeFor = (user: User) => (user.role === "admin" ? "/admin" : "/dashboard");

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    setSession(null);
  }
}
