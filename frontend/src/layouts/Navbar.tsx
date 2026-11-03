import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../app/providers";
import { ArrowRight, Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";

export function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // On the auth pages the navbar offers just one outlined button: the *other* auth page.
  const authSwitch =
    pathname === "/login" ? { href: "/signup", label: t.nav.signup } :
    pathname === "/signup" ? { href: "/login", label: t.nav.login } : null;

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/how-it-works", label: t.nav.howItWorks },
    { href: "/features", label: t.nav.features },
    { href: "/pricing", label: t.nav.pricing },
    { href: "#faq", label: t.nav.faq },
  ];

  // Close the mobile menu with Escape, as users expect from a disclosure panel.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const linkItems = links.map((l) => (
    <a
      key={l.href}
      href={l.href}
      className={pathname === l.href ? "active" : ""}
      aria-current={pathname === l.href ? "page" : undefined}
      onClick={() => setMenuOpen(false)}
    >
      {l.label}
    </a>
  ));

  return (
    <header className={menuOpen ? "navbar menu-open" : "navbar"}>
      <Logo />

      <nav className="nav-links" aria-label={t.nav.primaryNav}>
        {linkItems}
      </nav>

      <div className="nav-actions">
        <div className="lang-toggle" role="group" aria-label={t.nav.language}>
          <button
            type="button"
            className={lang === "ta" ? "active" : ""}
            aria-pressed={lang === "ta"}
            onClick={() => setLang("ta")}
          >
            தமிழ்
          </button>
          <button
            type="button"
            className={lang === "en" ? "active" : ""}
            aria-pressed={lang === "en"}
            onClick={() => setLang("en")}
          >
            English
          </button>
        </div>
        {authSwitch ? (
          <a href={authSwitch.href} className="nav-auth-switch">{authSwitch.label}</a>
        ) : (
          <>
            <a href="/login" className="nav-login">
              {t.nav.login}
            </a>
            <Button href="/signup" className="nav-trial">
              {t.nav.trial} <ArrowRight />
            </Button>
          </>
        )}
        <button
          type="button"
          className="nav-burger"
          aria-label={t.nav.menu}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div id="mobile-menu" className="nav-menu" hidden={!menuOpen}>
        <nav aria-label={t.nav.mobileNav}>{linkItems}</nav>
        <a href="/login" className="nav-menu-login" onClick={() => setMenuOpen(false)}>
          {t.nav.login}
        </a>
        <Button href="/signup" className="nav-menu-trial">
          {t.nav.trial} <ArrowRight />
        </Button>
      </div>
    </header>
  );
}
