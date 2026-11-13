import type { ReactNode } from "react";
import { useLanguage } from "../../app/providers";
import { homeFor, useSession } from "../../app/session";
import { ArrowRight } from "../../components/ui/Button";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// One icon + illustration per feature, in the same order as t.features.items.
const FEATURE_ART: { img: string; tone: string; icon: ReactNode }[] = [
  {
    img: "/features/01-hints.png",
    tone: "amber",
    icon: <span aria-hidden="true">💡</span>,
  },
  {
    img: "/features/02-handwritten.png",
    tone: "pink",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5" />
        <path d="M12 20v-8M9 15l3-3 3 3" />
      </svg>
    ),
  },
  {
    img: "/features/03-voice.png",
    tone: "pink",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
      </svg>
    ),
  },
  {
    img: "/features/04-past-papers.png",
    tone: "pink",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    img: "/features/05-daily-quiz.png",
    tone: "amber",
    icon: <span aria-hidden="true">🔥</span>,
  },
  {
    img: "/features/06-saved.png",
    tone: "pink",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
];

/** "Features" on the landing page: the feature cards. */
export function Features() {
  const { t } = useLanguage();
  const user = useSession();
  const f = t.features;

  return (
    <section id="features" className="landing-section" aria-labelledby="features-title">
      <div className="how-hero">
        <div className="how-hero-copy">
          <span className="pill pill-amber">☀ {f.badge}</span>
          <h2 id="features-title" className="how-title">
            {f.titleLead} <span className="accent">{f.titleAccent}</span>
          </h2>
          <p className="how-sub">{f.subtitle}</p>
        </div>
        <img className="how-hero-bear feat-bear" src="/pricing/bear-books.png" alt="" aria-hidden="true" loading="lazy" />
        <span className="how-formula" aria-hidden="true">
          x<sup>2</sup>+y<sup>2</sup>
        </span>
        <svg className="deco deco-tri" viewBox="0 0 60 60" aria-hidden="true">
          <path d="M14 8 L50 46 L6 52 Z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
        </svg>
      </div>

      <ol className="feat-grid">
        {f.items.map((item, i) => {
          const art = FEATURE_ART[i];
          return (
            <li key={item.title} className="feat-card">
              <span className="feat-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="feat-head">
                <span className={`feat-icon tone-${art.tone}`}>{art.icon}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
              <div className="feat-art">
                <img src={art.img} alt={item.imageAlt} loading="lazy" />
              </div>
              <a href={user ? homeFor(user) : "/signup"} className="feat-more" aria-label={`${f.learnMore}: ${item.title}`}>
                <ArrowRight />
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
