import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../components/feedback/ErrorBoundary";
import { icons } from "../features/dashboard/icons";
import { ApiError, authApi, type User } from "../services/api";
import { setSession } from "../app/session";
import "../styles/dashboard.css";
import "../styles/admin.css";
import { ThemeToggle } from "../components/ThemeToggle";

export interface AdminContext {
  user: User;
}

// Admin pages are for KELU staff, so they are English only (no Tamil strings).
const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/admin", label: "Overview", icon: icons.home },
  { to: "/admin/students", label: "Students", icon: icons.users },
  { to: "/admin/payments", label: "Subscriptions & Payments", icon: icons.card },
  { to: "/admin/plans", label: "Plans", icon: icons.crown },
  { to: "/admin/quiz-bank", label: "Quiz Bank", icon: icons.layers },
  { to: "/admin/feedback", label: "Student Feedback", icon: icons.chat },
  { to: "/admin/content", label: "Content", icon: icons.doc },
  { to: "/admin/knowledge-base", label: "Knowledge Base", icon: icons.database },
];

const ENV = import.meta.env.MODE === "production" ? "Production" : "Development";

/** Admin shell: the student dashboard's sidebar and shell styles (db-*), admin navigation.
 *  Not logged in -> /login; a student -> their own dashboard. The API checks the role
 *  again on every admin request, so this redirect is only for a friendly UI. */
export function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi.me().then((u) => {
      setSession(u);
      if (u.role !== "admin") navigate("/dashboard", { replace: true });
      else setUser(u);
    }, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
    });
  }, [navigate]);

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
      setSession(null);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (!user) return <div className="db-loading" role="status">Loading…</div>;

  return (
    <div className={`db-shell ad-shell${menuOpen ? " menu-open" : ""}`}>
      <aside className="db-sidebar" aria-label="Admin navigation">
        <div className="db-brand">
          <button className="db-icon-btn" type="button" aria-label="Open menu"
            aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {icons.menu}
          </button>
          <Link to="/admin" className="db-logo">
            <img src="/kelu-logo.png" alt="KELU – AI Math Tutor" />
          </Link>
        </div>
        <nav className="db-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/admin"} onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `db-nav-link${isActive ? " active" : ""}`}>
              <span className="db-nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <hr className="db-nav-rule" />
          <button type="button" className="db-nav-link ad-logout" onClick={logout}>
            <span className="db-nav-icon">{icons.logout}</span>
            Log out
          </button>
        </nav>
      </aside>
      {menuOpen && <div className="db-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="db-main">
        <header className="db-topbar">
          <button className="db-icon-btn db-mobile-only" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            {icons.menu}
          </button>
          <div className="db-topbar-actions">
            <ThemeToggle />
            <span className={`ad-env ${ENV.toLowerCase()}`}><i aria-hidden="true" />{ENV}</span>
            <div className="db-account" ref={accountRef}>
              <button type="button" className="db-account-btn" aria-haspopup="menu" aria-expanded={accountOpen}
                onClick={() => setAccountOpen((o) => !o)}>
                <span className="db-avatar">{user.full_name.trim().charAt(0).toUpperCase()}</span>
                <span className="ad-account-copy">
                  <strong>{user.full_name}</strong>
                  <small>System administrator</small>
                </span>
                {icons.chevronDown}
              </button>
              {accountOpen && (
                <div className="db-account-menu" role="menu">
                  <div className="db-account-email">{user.email}</div>
                  <button role="menuitem" type="button" onClick={logout}>{icons.logout}Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <ErrorBoundary fallback={(reload) => (
          <main className="db-content">
            <section className="db-card db-soon" role="alert">
              <h2>Something went wrong on this page.</h2>
              <button type="button" className="db-btn-primary" onClick={reload}>Reload</button>
            </section>
          </main>
        )}>
          <Outlet context={{ user } satisfies AdminContext} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
