import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "../app/providers";
import { ArrowRight } from "../components/ui/Button";
import { Navbar } from "../layouts/Navbar";
import { plansApi, type PublicPlan } from "../services/api";
import type { PlanCopy } from "../utils/i18n";

// Names, prices, descriptions, which plans show and the "best value" badge come from GET /plans,
// which admins edit on Admin > Plans. Until it answers (or if it can't), the backend defaults
// below are shown, so the page never renders empty. Perks and button text are page copy (i18n).
type PlanKey = PublicPlan["key"];
const DEFAULT_PLANS: Pick<PublicPlan, "key" | "billing" | "price_lkr" | "highlight">[] = [
  { key: "free", billing: "free", price_lkr: 0, highlight: false },
  { key: "monthly", billing: "month", price_lkr: 1500, highlight: false },
  { key: "until_exam", billing: "until_exam", price_lkr: 12000, highlight: true },
  { key: "class", billing: "student_month", price_lkr: 1000, highlight: false },
];

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS = {
  sprout: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20v-7" stroke="#3f9a2c" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-4 3-6.500 7-6.500 0 4-3 6.500-7 6.500z" fill="#4caf38" />
      <path d="M7 20h10l-1.200 3H8.200z" fill="#f2a33a" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <circle cx="9" cy="8" r="3.200" /><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6" />
      <path d="M16 4.300a3.200 3.200 0 0 1 0 6.400M18 14.300c1.800.800 3 2.700 3 5.700" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z" fill="#f6b21b" stroke="#e0950c" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  shield: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6z" /><path d="M9 12l2.200 2.200L15 10" /></svg>,
  card: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.500" /><path d="M3 10h18M7 15h4" /></svg>,
  lock: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.500" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>,
  star: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 3l2.800 5.700 6.200.900-4.500 4.400 1 6.200L12 17.300 6.500 20.200l1-6.200L3 9.600l6.200-.900z" /></svg>,
  heart: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" /></svg>,
};

const TRUST_ICONS = [ICONS.shield, ICONS.card, ICONS.lock, ICONS.star, ICONS.heart];

function Check() {
  return (
    <svg className="plan-check" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" />
      <path d="M6 10.300l2.600 2.500L14 7.500" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PLAN_ICON: Record<PlanKey, ReactNode> = {
  free: ICONS.sprout, monthly: ICONS.calendar, until_exam: ICONS.crown, class: ICONS.users,
};

interface PlanCardProps {
  plan: PlanCopy;
  name: string;
  tagline: string;
  icon: ReactNode;
  price: ReactNode;
  variant: "free" | "paid" | "best";
  ribbon?: string;
  note?: string;
}

function PlanCard({ plan, name, tagline, icon, price, variant, ribbon, note }: PlanCardProps) {
  return (
    <li className={`plan plan-${variant}`}>
      {ribbon && <span className="plan-ribbon">{ICONS.crown} {ribbon}</span>}
      <div className="plan-head">
        <span className="plan-icon">{icon}</span>
        <div>
          <h2>{name}</h2>
          <p>{tagline}</p>
        </div>
      </div>
      <div className="plan-price">
        {price}
        <span className="plan-period">{plan.period}</span>
      </div>
      <ul className="plan-perks">
        {plan.perks.map((perk) => (
          <li key={perk}><Check />{perk}</li>
        ))}
      </ul>
      <a href="/signup" className="plan-cta">
        {plan.cta} <ArrowRight />
      </a>
      {note && <small className="plan-note">{note}</small>}
    </li>
  );
}

export function PricingPage() {
  const { t, lang } = useLanguage();
  const p = t.pricing;
  const fmt = (n: number) => n.toLocaleString(lang === "ta" ? "ta-LK" : "en-LK");
  const [live, setLive] = useState<PublicPlan[]>();
  useEffect(() => {
    plansApi.list().then((r) => setLive(r.plans), () => undefined);   // keep the defaults on failure
  }, []);
  const plans = live ?? DEFAULT_PLANS;

  return (
    <div className="page page-flow how-page">
      <Navbar />
      <main className="how-main">
        <section className="how-hero price-hero">
          <div className="how-hero-copy">
            <span className="pill pill-amber"><span className="pill-crown">{ICONS.crown}</span> {p.badge}</span>
            <h1 className="price-title">
              <span>{p.titleLine1}</span>
              <span className="accent">{p.titleLine2}</span>
            </h1>
            <p className="how-sub">{p.subtitle}</p>
          </div>
          <img className="price-bear" src="/pricing/bear-books.png" alt="" aria-hidden="true" />
          <span className="deco price-eq" aria-hidden="true">x<sup>2</sup>+y<sup>2</sup>=?</span>
          <svg className="deco price-plane" viewBox="0 0 80 60" aria-hidden="true">
            <path d="M4 30L76 4 54 54 38 36z" fill="#fde2ee" stroke="#f3a9c8" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M38 36L76 4" stroke="#f3a9c8" strokeWidth="1.5" />
          </svg>
          <svg className="deco price-tri" viewBox="0 0 80 80" aria-hidden="true">
            <path d="M40 6L72 62H10z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M40 6V62" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        </section>

        <ol className={`plans plans-${plans.length}`}>
          {plans.map((plan) => {
            const copy = p.plans[plan.key];
            const fromApi = "name_en" in plan ? plan as PublicPlan : undefined;
            const free = plan.billing === "free";
            return (
              <PlanCard
                key={plan.key}
                variant={free ? "free" : plan.highlight ? "best" : "paid"}
                plan={copy}
                name={fromApi ? (lang === "ta" ? fromApi.name_ta : fromApi.name_en) : copy.name}
                tagline={fromApi ? (lang === "ta" ? fromApi.blurb_ta : fromApi.blurb_en) : copy.tagline}
                icon={PLAN_ICON[plan.key]}
                ribbon={plan.highlight ? p.bestValue : undefined}
                price={free ? <span className="plan-amount">{p.free}</span>
                  : <><span className="plan-cur">LKR</span><span className="plan-amount">{fmt(plan.price_lkr)}</span></>}
                note={free ? `${t.how.ctaNote1} · ${t.how.ctaNote2}` : undefined}
              />
            );
          })}
        </ol>

        <ul className="trust-strip">
          {p.trust.map((label, i) => (
            <li key={label}>{TRUST_ICONS[i]}<span>{label}</span></li>
          ))}
        </ul>
      </main>
    </div>
  );
}
