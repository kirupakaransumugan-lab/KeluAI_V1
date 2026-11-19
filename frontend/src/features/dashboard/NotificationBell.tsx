import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { notificationsApi, type AppNotification } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "./icons";

// When the bell was last opened, per browser: a convenience only. If storage is blocked the dot
// simply shows again, which is harmless.
const SEEN_KEY = "kelu.notifications.seen";
const REFRESH_MS = 5 * 60 * 1000;     // plan days and the quiz limit change during a session

function readSeen(): number {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}
function writeSeen(at: number) {
  try { localStorage.setItem(SEEN_KEY, String(at)); } catch { /* private window: ignore */ }
}

const LINK: Record<AppNotification["kind"], string> = {
  plan_ending: "/dashboard/subscription",
  plan_ended: "/dashboard/subscription",
  payment: "/dashboard/subscription",
  feedback_closed: "/dashboard/practice",
  full_quiz_unlocked: "/dashboard/practice",
  quiz_limit: "/dashboard/practice",
};

/** The top bar's bell: a red dot for alerts newer than the last time it was opened. */
export function NotificationBell() {
  const { lang, t } = useLanguage();
  const d = t.dashboard;
  const b = d.bell;
  const [items, setItems] = useState<AppNotification[]>();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    notificationsApi.list().then((r) => { setItems(r.items); setFailed(false); }, () => setFailed(true));
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Close on an outside click or Escape, like the account menu.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = (items ?? []).filter((n) => Date.parse(n.at) > seen).length;

  const toggle = () => {
    if (!open) {
      load();
      const now = Date.now();
      writeSeen(now);
      setSeen(now);
    }
    setOpen((o) => !o);
  };

  const plan = (key?: string) => b.plans[key as keyof typeof b.plans] ?? key ?? "";
  const text = (n: AppNotification): string => {
    switch (n.kind) {
      case "plan_ending":
        return n.data.days ? fill(b.planEnding, { plan: plan(n.data.plan), days: n.data.days })
          : fill(b.planEndsToday, { plan: plan(n.data.plan) });
      case "plan_ended": return fill(b.planEnded, { plan: plan(n.data.plan) });
      case "payment":
        return fill(b.payment, { plan: plan(n.data.plan), amount: (n.data.amount_lkr ?? 0).toLocaleString() });
      case "feedback_closed": return fill(b.feedbackClosed, { topic: n.data.topic ?? "" });
      case "full_quiz_unlocked": return b.fullQuiz;
      case "quiz_limit": return fill(b.quizLimit, { limit: n.data.limit ?? 0 });
    }
  };
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ta" ? "ta-LK" : "en-LK", { day: "numeric", month: "short" });

  return (
    <div className="db-bell-wrap" ref={boxRef}>
      <button className="db-icon-btn db-bell" type="button" onClick={toggle}
        aria-label={unread ? `${d.nav.notifications} (${unread})` : d.nav.notifications}
        aria-haspopup="true" aria-expanded={open}>
        {icons.bell}{unread > 0 && <span className="db-bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="db-bell-menu" role="region" aria-label={b.title}>
          <div className="db-bell-title">{b.title}</div>
          {failed && !items ? <p className="db-bell-empty">{b.failed}</p>
            : !items ? null
            : items.length === 0 ? <p className="db-bell-empty">{b.empty}</p>
            : (
              <ul className="db-bell-list">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link to={LINK[n.kind]} onClick={() => setOpen(false)}>
                      <span>{text(n)}</span>
                      <time dateTime={n.at}>{when(n.at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}
