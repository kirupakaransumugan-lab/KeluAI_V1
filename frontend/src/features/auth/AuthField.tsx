import type { ReactNode } from "react";

// Shared by the sign-up and log-in forms.

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ICONS = {
  user: <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.500-4 4.500-6 8-6s6.500 2 8 6" /></svg>,
  mail: <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2.500" /><path d="M4 7l8 6 8-6" /></svg>,
  phone: <svg viewBox="0 0 24 24" {...stroke}><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>,
  lock: <svg viewBox="0 0 24 24" {...stroke}><rect x="5" y="10" width="14" height="11" rx="2.500" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>,
  calendar: <svg viewBox="0 0 24 24" {...stroke}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
  shield: <svg viewBox="0 0 24 24" {...stroke}><path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6z" /><path d="M9 12l2.200 2.200L15 10" /></svg>,
  eye: <svg viewBox="0 0 24 24" {...stroke}><path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg viewBox="0 0 24 24" {...stroke}><path d="M3 3l18 18M10.600 6.100A10 10 0 0 1 12 6c6.500 0 10 6 10 6a17 17 0 0 1-3.200 3.900M6.600 6.600C3.800 8.300 2 12 2 12s3.500 7 10 7a9.700 9.700 0 0 0 4.400-1.100" /><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200" /></svg>,
  tick: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="M6 10.300l2.600 2.500L14 7.500" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  chevron: <svg viewBox="0 0 24 24" {...stroke}><path d="M6 9l6 6 6-6" /></svg>,
  card: <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.500" /><path d="M3 10h18M7 15h4" /></svg>,
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.500 12.300c0-.800-.100-1.600-.200-2.300H12v4.500h6.500a5.600 5.600 0 0 1-2.400 3.600v3h3.900c2.200-2.100 3.500-5.100 3.500-8.800z" />
      <path fill="#34A853" d="M12 24c3.200 0 6-1.100 8-2.900l-3.900-3c-1.100.700-2.500 1.200-4.100 1.200-3.100 0-5.800-2.100-6.700-5H1.300v3.100A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.300 14.300a7.200 7.200 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800z" />
      <path fill="#EA4335" d="M12 4.800c1.800 0 3.300.600 4.600 1.800l3.400-3.400A11.500 11.500 0 0 0 12 0 12 12 0 0 0 1.300 6.600l4 3.100c.900-2.800 3.600-4.900 6.700-4.900z" />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10.500v10.500H1z" />
      <path fill="#7FBA00" d="M12.500 1H23v10.500H12.500z" />
      <path fill="#00A4EF" d="M1 12.500h10.500V23H1z" />
      <path fill="#FFB900" d="M12.500 12.500H23V23H12.500z" />
    </svg>
  ),
};

interface FieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  help?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}

export function Field({ id, label, icon, error, help, children, trailing }: FieldProps) {
  return (
    <div className={error ? "su-field has-error" : "su-field"}>
      <label htmlFor={id}>{label}</label>
      <div className="su-input">
        <span className="su-icon" aria-hidden="true">{icon}</span>
        {children}
        {trailing}
      </div>
      {error ? (
        <p className="su-error" id={`${id}-msg`} role="alert">{error}</p>
      ) : (
        help && <div className="su-help" id={`${id}-msg`}>{help}</div>
      )}
    </div>
  );
}

export function PasswordToggle({ shown, onToggle, showLabel, hideLabel }: { shown: boolean; onToggle: () => void; showLabel: string; hideLabel: string }) {
  return (
    <button type="button" className="su-eye" aria-label={shown ? hideLabel : showLabel} aria-pressed={shown} onClick={onToggle}>
      {shown ? ICONS.eye : ICONS.eyeOff}
    </button>
  );
}
