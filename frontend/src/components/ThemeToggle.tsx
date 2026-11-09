import { useLanguage, useTheme } from "../app/providers";

const sun = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);
const moon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

/** Switches light/dark. Shows what you'll switch TO, and says so to screen readers. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const label = theme === "dark" ? t.nav.lightMode : t.nav.darkMode;
  return (
    <button type="button" className={`theme-toggle ${className}`.trim()} onClick={toggleTheme}
      aria-label={label} title={label}>
      {theme === "dark" ? sun : moon}
    </button>
  );
}
