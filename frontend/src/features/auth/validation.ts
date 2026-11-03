// Client-side checks that mirror backend/app/schemas/auth.py. The server is the
// source of truth; these only give students instant feedback.

export const MOBILE_RE = /^(?:\+94|94|0)7\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_MAX_BYTES = 72;
export const EXAM_YEARS_AHEAD = 3;

export interface SignupValues {
  full_name: string;
  email: string;
  mobile: string;
  password: string;
  medium: "ta" | "en";
  al_exam_year: string;
  accept_terms: boolean;
}

export type SignupField = Exclude<keyof SignupValues, "medium">;
export type FieldErrors = Partial<Record<SignupField, string>>;

export function examYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return Array.from({ length: EXAM_YEARS_AHEAD + 1 }, (_, i) => y + i);
}

/** Returns the i18n error key for a field, or undefined when it's valid. */
export function validateField(field: SignupField, v: SignupValues): string | undefined {
  switch (field) {
    case "full_name":
      return v.full_name.trim().replace(/\s+/g, " ").length >= 2 ? undefined : "full_name";
    case "email":
      return EMAIL_RE.test(v.email.trim()) ? undefined : "email";
    case "mobile":
      return MOBILE_RE.test(v.mobile.replace(/[\s\-()]/g, "")) ? undefined : "mobile";
    case "password":
      if (v.password.length < 8) return "password";
      return new TextEncoder().encode(v.password).length > BCRYPT_MAX_BYTES ? "passwordTooLong" : undefined;
    case "al_exam_year":
      return v.al_exam_year ? undefined : "al_exam_year";
    case "accept_terms":
      return v.accept_terms ? undefined : "accept_terms";
  }
}

/** 0 = empty/too short … 4 = strong. Feeds the four-dot meter. */
export function passwordScore(pw: string): number {
  if (pw.length < 8) return pw.length ? 1 : 0;
  let score = 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}
