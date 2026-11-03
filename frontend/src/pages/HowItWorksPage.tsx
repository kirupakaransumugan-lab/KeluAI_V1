import { useLanguage } from "../app/providers";
import { ArrowRight, Button } from "../components/ui/Button";
import { Navbar } from "../layouts/Navbar";
import { TryDemo } from "./how-it-works/TryDemo";

const STEP_IMAGES = [
  "/how-it-works/step-1-diagnostic.png",
  "/how-it-works/step-2-plan.png",
  "/how-it-works/step-3-hints.png",
  "/how-it-works/step-4-progress.png",
];

export function HowItWorksPage() {
  const { t } = useLanguage();
  const h = t.how;

  return (
    <div className="page page-flow how-page">
      <Navbar />
      <main className="how-main">
        <section className="how-hero">
          <div className="how-hero-copy">
            <span className="pill pill-amber">☀ {h.badge}</span>
            <h1 className="how-title">
              {h.titleLead && <>{h.titleLead} </>}<span className="accent">{h.titleAccent}</span> {h.titleTail}
            </h1>
            <p className="how-sub">{h.subtitle}</p>
          </div>
          <img className="how-hero-bear" src="/how-it-works/bear-pencil.png" alt="" aria-hidden="true" />
          <span className="how-formula" aria-hidden="true">
            x<sup>2</sup>+y<sup>2</sup>
          </span>
          <span className="deco deco-bulb" aria-hidden="true">💡</span>
          <span className="deco deco-spark" aria-hidden="true">✦</span>
          <svg className="deco deco-tri" viewBox="0 0 60 60" aria-hidden="true">
            <path d="M14 8 L50 46 L6 52 Z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
        </section>

        <ol className="how-steps">
          {h.steps.map((s, i) => (
            <li key={s.title} className="how-step">
              <div className="how-step-art">
                <img src={STEP_IMAGES[i]} alt="" loading="lazy" />
              </div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              {i < h.steps.length - 1 && <span className="how-arrow" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        <section className="how-try" id="demo">
          <span className="pill pill-amber">💡 {h.tryBadge}</span>
          <h2 className="how-try-title">
            {h.tryLead} <span className="accent">{h.tryAccent}</span>
          </h2>
          <p className="how-sub">{h.trySub}</p>
          <span className="deco deco-eq" aria-hidden="true">y=mx+c</span>
          <svg className="deco deco-tri2" viewBox="0 0 60 60" aria-hidden="true">
            <path d="M40 6 L54 52 L8 40 Z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          </svg>
          <TryDemo />
        </section>

        <section className="how-cta">
          <img className="how-cta-bear" src="/how-it-works/bear-cheer.png" alt="" aria-hidden="true" />
          <div className="how-cta-copy">
            <h2>
              {h.ctaLead}
              <span>{h.ctaAccent}</span>
            </h2>
            <ul>
              {h.perks.map((p) => (
                <li key={p}><span className="tick" aria-hidden="true">✓</span>{p}</li>
              ))}
            </ul>
          </div>
          <div className="how-cta-action">
            <Button href="/signup" className="btn-lg">
              {h.ctaButton} <ArrowRight />
            </Button>
            <small>{h.ctaNote1} · {h.ctaNote2}</small>
          </div>
        </section>
      </main>
    </div>
  );
}
