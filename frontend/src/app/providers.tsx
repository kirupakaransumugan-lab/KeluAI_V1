import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCopy, type Copy, type Lang } from "../utils/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Copy;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

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
  // Screen readers pick the right voice from <html lang>, and CSS can tune Tamil layout.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <Providers>");
  return ctx;
}
