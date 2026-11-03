import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import { daysLeft, fill } from "../../utils/dates";
import { icons } from "./icons";

// Only real account data from /auth/me is shown. Study plan, topic scores, chats and
// weekly activity have no tables yet, so those cards show an empty state until they do.

function greetingKey(hour = new Date().getHours()): "morning" | "afternoon" | "evening" {
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="db-card">
      <header className="db-card-head">
        <span className="db-plum">{icon}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function EmptyState({ icon, title, text, action }: {
  icon: ReactNode; title: string; text: string; action?: { to: string; label: string };
}) {
  return (
    <div className="db-empty">
      <span className="db-empty-icon" aria-hidden="true">{icon}</span>
      <div className="db-empty-copy">
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {action && <Link to={action.to} className="db-btn-outline">{action.label}</Link>}
    </div>
  );
}

export function DashboardHome() {
  const { user } = useOutletContext<DashboardContext>();
  const { t } = useLanguage();
  const d = t.dashboard;
  const e = d.empty;
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const firstName = user.full_name.split(" ")[0];
  const trialDays = daysLeft(user.trial_ends_at);

  const ask = (ev: FormEvent) => {
    ev.preventDefault();
    const q = question.trim();
    if (q) navigate(`/dashboard/tutor?q=${encodeURIComponent(q)}`);
  };

  return (
    <main className="db-content">
      {/* ---------- Greeting + trial + bear ---------- */}
      <section className="db-hero">
        <div className="db-hero-copy">
          <div className="db-hero-head">
            <div>
              <h1 className="db-greeting">
                {fill(d.greeting[greetingKey()], { name: firstName })} <span aria-hidden="true">👋</span>
              </h1>
              {user.medium && (
                <p className="db-sub">
                  {user.al_exam_year && fill(d.examYear, { n: user.al_exam_year })} · {d.medium[user.medium]}
                </p>
              )}
            </div>
            {trialDays !== null && (
              <div className="db-chips">
                <div className="db-chip">
                  <span className="db-chip-icon db-plum">{icons.calendar}</span>
                  <span><strong>{fill(d.trialDays, { n: trialDays })}</strong>{d.trialLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="db-goal">
            <div className="db-goal-copy">
              <p className="db-eyebrow">{d.goalEyebrow} <span className="db-amber">{icons.sparkle}</span></p>
              <h2>{d.goalTitle}</h2>
              <p className="db-meta">{icons.clock}{d.goalMeta}</p>
            </div>
            <Link to="/dashboard/practice" className="db-btn-primary">{d.startQuiz} {icons.arrowRight}</Link>
            <img className="db-goal-art" src="/dashboard/goal.png" alt="" />
          </div>
        </div>
        <div className="db-hero-art" aria-hidden="true">
          <p className="db-bubble">{d.cheer} <span aria-hidden="true">💪</span></p>
          <img src="/dashboard/bear-desk.png" alt="" />
        </div>
      </section>

      {/* ---------- Cards (empty until their data exists) ---------- */}
      <div className="db-grid">
        <Card icon={icons.book} title={d.plan}>
          <EmptyState icon={icons.book} title={e.plan.title} text={e.plan.text}
            action={{ to: "/dashboard/practice", label: d.startQuiz }} />
        </Card>
        <Card icon={icons.target} title={d.needsWork}>
          <EmptyState icon={icons.target} title={e.needsWork.title} text={e.needsWork.text} />
        </Card>
        <Card icon={icons.history} title={d.continueTitle}>
          <EmptyState icon={icons.chat} title={e.continue.title} text={e.continue.text}
            action={{ to: "/dashboard/tutor", label: d.ask }} />
        </Card>
        <Card icon={icons.bars} title={d.thisWeek}>
          <EmptyState icon={icons.chart} title={e.week.title} text={e.week.text} />
        </Card>
      </div>

      {/* ---------- Ask bar ---------- */}
      <form className="db-ask" onSubmit={ask}>
        <span className="db-ask-spark">{icons.sparkle}</span>
        <input value={question} onChange={(ev) => setQuestion(ev.target.value)}
          placeholder={d.askPlaceholder} aria-label={d.askPlaceholder} />
        <button type="button" className="db-icon-btn" aria-label={d.voice}>{icons.mic}</button>
        <button type="button" className="db-icon-btn" aria-label={d.attach}>{icons.clip}</button>
        <button type="submit" className="db-ask-send" aria-label={d.ask}>{icons.arrowUpRight}</button>
      </form>
    </main>
  );
}

export function ComingSoon() {
  const { t } = useLanguage();
  const d = t.dashboard;
  return (
    <main className="db-content">
      <section className="db-card db-soon">
        <img src="/dashboard/partner.png" alt="" />
        <h1>{d.comingSoon}</h1>
        <p>{d.comingSoonText}</p>
        <Link to="/dashboard" className="db-btn-primary">{d.backHome} {icons.arrowRight}</Link>
      </section>
    </main>
  );
}
