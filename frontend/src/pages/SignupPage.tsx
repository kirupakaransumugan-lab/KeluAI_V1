import { useLanguage } from "../app/providers";
import { AuthLayout } from "../features/auth/AuthLayout";
import { SignupForm } from "../features/auth/SignupForm";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PERK_ICONS = [
  // target
  <svg key="t" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12l7-7M16 5h3v3" /></svg>,
  // plan sheet
  <svg key="p" viewBox="0 0 24 24" {...stroke}><rect x="5" y="3" width="14" height="18" rx="2.500" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>,
  // bulb
  <svg key="b" viewBox="0 0 24 24" {...stroke}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.600.500 1 1.200 1 2.100h5c0-.900.400-1.600 1-2.100A6 6 0 0 0 12 3z" /></svg>,
];

export function SignupPage() {
  const { t } = useLanguage();
  const s = t.signup;

  return (
    <AuthLayout
      pageClass="signup-page"
      title={
        <>
          <span>{s.titleLead}</span>
          <span><span className="accent underlined">{s.titleAccent}</span> {s.titleTail}</span>
        </>
      }
      subtitle={s.subtitle}
      extra={
        <ul className="su-perks">
          {s.perks.map((p, i) => (
            <li key={p.title}>
              <span className={`su-perk-icon p${i}`} aria-hidden="true">{PERK_ICONS[i]}</span>
              <span><strong>{p.title}</strong>{p.text}</span>
            </li>
          ))}
        </ul>
      }
      headingId="su-heading"
    >
      <SignupForm />
    </AuthLayout>
  );
}
