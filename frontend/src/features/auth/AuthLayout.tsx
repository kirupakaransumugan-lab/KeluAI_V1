import type { ReactNode } from "react";
import { Navbar } from "../../layouts/Navbar";

// Page shell shared by /signup and /login: pitch on the left over the bear
// illustration, the form card on the right.

interface AuthLayoutProps {
  pageClass: string;
  title: ReactNode;
  subtitle: string[];
  /** Extra content under the subtitle (e.g. the sign-up perks). */
  extra?: ReactNode;
  headingId: string;
  children: ReactNode;
}

export function AuthLayout({ pageClass, title, subtitle, extra, headingId, children }: AuthLayoutProps) {
  return (
    <div className={`page page-flow auth-page ${pageClass}`}>
      {/* Illustration (bear at the desk) is a page-level layer so the navbar floats over it. */}
      <div className="su-art" aria-hidden="true" />
      <Navbar />
      <main className="su-main">
        <section className="su-intro">
          <h1 className="su-title">{title}</h1>
          <p className="su-sub">{subtitle.map((l) => <span key={l}>{l}</span>)}</p>
          {extra}
          <span className="deco su-integral" aria-hidden="true">∫ x eˣ dx</span>
          <svg className="deco su-graph" viewBox="0 0 120 100" aria-hidden="true">
            <path d="M14 6v80h100" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 70c20-4 26-50 44-50s18 30 34 34 16-6 22-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M30 86L104 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" />
          </svg>
        </section>

        <section className="su-panel auth-card" aria-labelledby={headingId}>
          {children}
        </section>
      </main>
    </div>
  );
}
