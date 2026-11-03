import { useLanguage } from "../../app/providers";
import { ArrowRight, Button } from "../../components/ui/Button";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="hero">
      <img className="hero-leaves" src="/leaves-left.png" alt="" aria-hidden="true" />
      <div className="hero-art" aria-hidden="true">
        <span className="formula">
          x<sup>2</sup>+y<sup>2</sup>
        </span>
      </div>

      <div className="hero-copy">
        <h1>
          <span>{t.titleLine1}</span>
          <span className="accent">{t.titleHighlight}</span>
          <span className="underlined">{t.titleLine3}</span>
        </h1>

        <p className="hero-sub">
          {t.subtitle.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>

        <div className="hero-ctas">
          <Button href="/signup" className="btn-lg">
            {t.ctaPrimary} <ArrowRight />
          </Button>
          <a href="#demo" className="demo-link">
            <span className="play" aria-hidden="true">▶</span>
            {t.ctaSecondary}
          </a>
        </div>

      </div>

      <ul className="hero-assurances" aria-label={t.trialTerms}>
          <li>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#8c1d6b" strokeWidth="1.8" />
              <path d="M3.5 7l8.5 6 8.5-6" stroke="#8c1d6b" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            {t.noCard}
          </li>
          <li>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.500-7-10V6l7-3z" stroke="#8c1d6b" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 12l2.200 2.200L15 10" stroke="#8c1d6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.cancel}
          </li>
      </ul>
    </section>
  );
}
