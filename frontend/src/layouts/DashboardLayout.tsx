import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useLanguage } from "../app/providers";
import { ErrorBoundary } from "../components/feedback/ErrorBoundary";
import { icons } from "../features/dashboard/icons";
import { ApiError, authApi, type User } from "../services/api";
import "../styles/dashboard.css";

export interface DashboardContext {
  user: User;
}

const NAV: { to: string; key: "home" | "practice" | "tutor" | "pastPapers" | "progress" | "saved"; icon: ReactNode }[] = [
  { to: "/dashboard", key: "home", icon: icons.home },
  { to: "/dashboard/practice", key: "practice", icon: icons.pencil },
  { to: "/dashboard/tutor", key: "tutor", icon: icons.chat },
  { to: "/dashboard/past-papers", key: "pastPapers", icon: icons.paper },
  { to: "/dashboard/progress", key: "progress", icon: icons.chart },
  { to: "/dashboard/saved", key: "saved", icon: icons.bookmark },
];

const ACCOUNT_NAV = [
  { to: "/dashboard/subscription", key: "subscription", icon: icons.crown },
  { to: "/dashboard/settings", key: "settings", icon: icons.gear },
] as const;

/** Signed-in app shell: sidebar + top bar. Anyone not logged in is sent to /login.
 *  On the tutor the sidebar hides to give the chat room; it slides in when the pointer
 *  touches the left edge (or from the menu button, for keyboard and touch). */
export function DashboardLayout() {
  const { lang, setLang, t } = useLanguage();
  const d = t.dashboard;
  const navigate = useNavigate();
  const autoHide = !!useMatch("/dashboard/tutor/*");
  const [user, setUser] = useState<User>();
  const [menuOpen, setMenuOpen] = useState(false);       // mobile sidebar
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi.me().then(setUser, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
    });
  }, [navigate]);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAccountOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (!user) {
    return <div className="db-loading" role="status">{d.loading}</div>;
  }

  const link = (to: string, label: string, icon: ReactNode) => (
    <NavLink key={to} to={to} end={to === "/dashboard"} onClick={() => setMenuOpen(false)}
      className={({ isActive }) => `db-nav-link${isActive ? " active" : ""}`}>
      <span className="db-nav-icon">{icon}</span>
      {label}
    </NavLink>
  );

  return (
    <div className={`db-shell${autoHide ? " db-autohide" : ""}${menuOpen ? " menu-open" : ""}`}>
      {autoHide && <div className="db-edge" aria-hidden="true" />}
      <aside className="db-sidebar" aria-label={d.nav.sidebar}>
        <div className="db-brand">
          <button className="db-icon-btn" type="button" aria-label={d.nav.openMenu}
            aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {icons.menu}
          </button>
          <Link to="/dashboard" className="db-logo">
            <img src="/kelu-logo.png" alt="KELU – AI Math Tutor" />
          </Link>
        </div>
        <nav className="db-nav">
          {NAV.map((n) => link(n.to, d.nav[n.key], n.icon))}
          <hr className="db-nav-rule" />
          {ACCOUNT_NAV.map((n) => link(n.to, d.nav[n.key], n.icon))}
        </nav>
        <Link to="/dashboard/tutor" className="db-partner">
          <img src="/dashboard/partner.png" alt={d.partner} />
        </Link>
      </aside>
      {menuOpen && <div className="db-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="db-main">
        <header className="db-topbar">
          <button className="db-icon-btn db-mobile-only" type="button" aria-label={d.nav.openMenu}
            onClick={() => setMenuOpen(true)}>
            {icons.menu}
          </button>
          <div className="db-topbar-actions">
            <button className="db-icon-btn" type="button" aria-label={d.nav.search}>{icons.search}</button>
            <div className="db-lang" role="group" aria-label={t.nav.language}>
              <button type="button" className={lang === "ta" ? "active" : ""} aria-pressed={lang === "ta"}
                onClick={() => setLang("ta")}>தமிழ்</button>
              <button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"}
                onClick={() => setLang("en")}>English</button>
            </div>
            <button className="db-icon-btn db-bell" type="button" aria-label={d.nav.notifications}>
              {icons.bell}<span className="db-bell-dot" aria-hidden="true" />
            </button>
            <div className="db-account" ref={accountRef}>
              <button type="button" className="db-account-btn" aria-label={d.nav.account}
                aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((o) => !o)}>
                <span className="db-avatar">{user.full_name.trim().charAt(0).toUpperCase()}</span>
                <span className="db-account-name">{user.full_name.split(" ")[0]}</span>
                {icons.chevronDown}
              </button>
              {accountOpen && (
                <div className="db-account-menu" role="menu">
                  <div className="db-account-email">{user.email}</div>
                  <Link role="menuitem" to="/dashboard/settings" onClick={() => setAccountOpen(false)}>{icons.gear}{d.nav.settings}</Link>
                  <button role="menuitem" type="button" onClick={logout}>{icons.logout}{d.nav.logout}</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <ErrorBoundary fallback={(reload) => (
          <main className="db-content">
            <section className="db-card db-soon" role="alert">
              <h1>{d.crashTitle}</h1>
              <p>{d.crashText}</p>
              <button type="button" className="db-btn-primary" onClick={reload}>{d.reload}</button>
            </section>
          </main>
        )}>
          <Outlet context={{ user } satisfies DashboardContext} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
