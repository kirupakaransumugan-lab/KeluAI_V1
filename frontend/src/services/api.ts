// Thin fetch wrapper for the KELU API (all routes live under /api/v1).

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`API error ${status}`);
  }

  /** Field names the server rejected: from a 422 validation list or a `{field}` detail. */
  get fields(): string[] {
    const d = this.detail as { loc?: unknown[] }[] | { field?: string } | undefined;
    if (Array.isArray(d)) return d.map((e) => String(e.loc?.[e.loc.length - 1] ?? ""));
    if (d && typeof d === "object" && "field" in d && d.field) return [d.field];
    return [];
  }

  get code(): string | undefined {
    const d = this.detail as { code?: string } | undefined;
    return d && !Array.isArray(d) ? d.code : undefined;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, (data as { detail?: unknown } | undefined)?.detail);
  return data as T;
}

export type Medium = "ta" | "en";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: "student" | "admin";
  medium: Medium | null; // null for admins
  al_exam_year: number | null;
  trial_ends_at: string | null;
}

export interface RegisterInput {
  full_name: string;
  email: string;
  mobile: string;
  password: string;
  medium: Medium;
  al_exam_year: number;
  accept_terms: boolean;
}

/** The KELU-specific details Google doesn't know, asked once on first Google sign-in. */
export type StudentProfileInput = Pick<RegisterInput, "mobile" | "medium" | "al_exam_year" | "accept_terms">;

/** detail of the 428 "profile_required" answer from /auth/google. */
export interface GoogleProfileRequired {
  code: "profile_required";
  full_name: string;
  email: string;
}

export const authApi = {
  register: (input: RegisterInput) => request<{ user: User }>("POST", "/auth/register", input),
  login: (email: string, password: string) => request<{ user: User }>("POST", "/auth/login", { email, password }),
  providers: () => request<{ google_client_id: string | null }>("GET", "/auth/providers"),
  google: (credential: string, profile?: StudentProfileInput) =>
    request<{ user: User }>("POST", "/auth/google", { credential, profile }),
  forgotPassword: (email: string) => request<{ status: string }>("POST", "/auth/password/forgot", { email }),
  verifyResetCode: (email: string, code: string) =>
    request<{ reset_token: string }>("POST", "/auth/password/verify", { email, code }),
  resetPassword: (reset_token: string, new_password: string) =>
    request<{ user: User }>("POST", "/auth/password/reset", { reset_token, new_password }),
  me: () => request<User>("GET", "/auth/me"),
  logout: () => request<void>("POST", "/auth/logout"),
};

export type TutorMode = "practice" | "exam" | "review" | "free";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** A past-paper passage the reply cites as [S1], [S2]... */
export interface TutorSource {
  label: string;
  title: string;
  upload_type: string;
  exam_year: number | null;
  page: number | null;
  paper: string | null;
  paper_part: string | null;
  question_number: string | null;
}

export interface TutorReply {
  content: string;
  sources: TutorSource[];
  truncated: boolean;
  hint_level: number;
}

export interface QuizStepOption {
  text: string;      // the working, in LaTeX
  why: string;       // why it's the right move, or the mistake in it
  correct: boolean;
}

export interface QuizStep {
  title: string;
  options: QuizStepOption[];   // RIGHT first from the API; the UI shuffles
}

/** An AI-written practice question in past-paper style (backend app/rag/quiz.py). */
export interface QuizQuestion {
  number: number;
  topic: string;
  question: string;
  answer: string;
  modelled_on: Partial<TutorSource>;
  steps: QuizStep[];           // may be empty: the UI falls back to "Show answer"
}

export interface QuizResult {
  questions: QuizQuestion[];
  dropped: number;
}

export const tutorApi = {
  chat: (history: ChatTurn[], lang: Medium, hint_level: number, mode: TutorMode = "practice") =>
    request<TutorReply>("POST", "/tutor/chat", { history, lang, hint_level, mode }),
  quiz: (lang: Medium, count = 10) => request<QuizResult>("POST", "/tutor/quiz", { lang, count }),
};
