import { useEffect, useState, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../app/providers";
import { ArrowRight, Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { scrollToSection } from "../utils/scroll";

/** Id of the section crossing the middle of the screen, or null (none of `ids` on this page). */
function useSectionInView(ids: string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  const key = ids.join(" ");
  useEffect(() => {
    const els = key.split(" ").map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) { setCurrent(null); return; }
    // A thin band across the middle of the viewport: the section in it is the one being read.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
  return current;
}

export function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // On the auth pages the navbar offers just one outlined button: the *other* auth page.
  const authSwitch =
    pathname === "/login" ? { href: "/signup", label: t.nav.signup } :
    pathname === "/signup" ? { href: "/login", label: t.nav.login } : null;

  // Every link is a section of the one-page landing site (pages/HomePage.tsx).
  const links = [
    { id: "home", label: t.nav.home },
    { id: "how-it-works", label: t.nav.howItWorks },
    { id: "features", label: t.nav.features },
    { id: "pricing", label: t.nav.pricing },
    { id: "faq", label: t.nav.faq },
  ];
  const onHome = pathname === "/";
  const inView = useSectionInView(onHome ? links.map((l) => l.id) : []);
  const active = onHome ? inView ?? "home" : null;

  // On the landing page a link scrolls to its section (smoothly, see html in global.css) and
  // keeps the URL in step. From any other page it is a normal link to /#section.
  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    setMenuOpen(false);
    if (!onHome) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (id === "home") window.scrollTo({ top: 0 });
    else scrollToSection(el);
    history.replaceState(history.state, "", id === "home" ? "/" : `#${id}`);
  };

  // Close the mobile menu with Escape, as users expect from a disclosure panel.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const linkItems = links.map((l) => (
    <a
      key={l.id}
      href={l.id === "home" ? "/" : `/#${l.id}`}
      className={active === l.id ? "active" : ""}
      aria-current={active === l.id ? "location" : undefined}
      onClick={(e) => go(e, l.id)}
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
        <ThemeToggle />
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
