import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCopy, type Copy, type Lang } from "../utils/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Copy;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = "kelu-theme";
const darkQuery = () => window.matchMedia?.("(prefers-color-scheme: dark)");

/** The saved choice, or null to follow the device. index.html reads the same key before paint. */
function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Remembered across pages: the navbar links are full page loads, so without this
  // every click would drop a Tamil reader back to English.
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem("kelu-lang") === "ta" ? "ta" : "en";
    } catch {
      return "en"; // storage blocked (private mode etc.)
    }
  });
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("kelu-lang", next);
    } catch {
      /* not critical: the choice just won't be remembered */
    }
  };
  const value = useMemo(() => ({ lang, setLang, t: getCopy(lang) }), [lang]);

  // Theme: follows the device until the student picks one with the toggle.
  const [chosen, setChosen] = useState<Theme | null>(savedTheme);
  const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? false);
  useEffect(() => {
    const mq = darkQuery();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const theme: Theme = chosen ?? (systemDark ? "dark" : "light");
  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen;
    else delete document.documentElement.dataset.theme;
  }, [chosen]);
  const themeValue = useMemo<ThemeContextValue>(() => ({
    theme,
    toggleTheme: () => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      setChosen(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* not critical: the choice just won't be remembered */
      }
    },
  }), [theme]);

  // Screen readers pick the right voice from <html lang>, and CSS can tune Tamil layout.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <ThemeContext.Provider value={themeValue}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <Providers>");
  return ctx;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <Providers>");
  return ctx;
}
