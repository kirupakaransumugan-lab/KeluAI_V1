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
  mobile: string;              // E.164, e.g. +94771234567
  parent_email: string | null;
  has_password: boolean;       // false: Google-only account (can set a first password)
}

export interface ProfileUpdate {
  full_name?: string;
  mobile?: string;
  medium?: Medium;
  al_exam_year?: number;
  parent_email?: string;
  clear_parent_email?: boolean;
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
  updateProfile: (changes: ProfileUpdate) => request<User>("PATCH", "/auth/me", changes),
  changePassword: (current_password: string | null, new_password: string) =>
    request<{ user: User }>("POST", "/auth/password/change", { current_password, new_password }),
  deleteAccount: (confirm_email: string, password: string | null) =>
    request<void>("DELETE", "/auth/me", { confirm_email, password }),
};

/** A bookmarked practice question (GET /saved-questions), kept on the server across devices. */
export interface SavedQuestion {
  id: number;
  topic: string;
  question: string;
  answer: string;
  saved_at: string;
}

export const savedApi = {
  list: () => request<{ questions: SavedQuestion[] }>("GET", "/saved-questions"),
  save: (q: { topic: string; question: string; answer: string }) => request<SavedQuestion>("POST", "/saved-questions", q),
  remove: (id: number) => request<void>("DELETE", `/saved-questions/${id}`),
  importLocal: (questions: { topic: string; question: string; answer: string }[]) =>
    request<{ added: number }>("POST", "/saved-questions/import", { questions }),
};

/** An AI-tutor chat as the server stores it (GET/PUT /tutor/conversations). */
export interface ServerChat {
  id: string;
  title: string;
  saved: boolean;
  hint_level: number;
  messages: unknown[];          // the browser's Message objects, stored as sent
  created_ms: number;
  updated_ms: number;
}

export const chatsApi = {
  list: () => request<{ conversations: ServerChat[] }>("GET", "/tutor/conversations"),
  save: (c: Omit<ServerChat, "id">, id: string) =>
    request<ServerChat>("PUT", `/tutor/conversations/${encodeURIComponent(id)}`, c),
  remove: (id: string) => request<void>("DELETE", `/tutor/conversations/${encodeURIComponent(id)}`),
};

export type PlanKey = "trial" | "monthly" | "annual";

export interface SubscriptionRow {
  id: number;
  plan: PlanKey | string;
  status: "trialing" | "active" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string;
  days_left: number;
}

/** GET /subscription (backend app/services/subscription.py). */
export interface SubscriptionSummary {
  current: SubscriptionRow | null;
  history: SubscriptionRow[];
  plans: { key: "monthly" | "annual"; price_lkr: number; period: "month" | "year" }[];
  payments_enabled: boolean;
}

export const subscriptionApi = {
  get: () => request<SubscriptionSummary>("GET", "/subscription"),
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
  bank_id?: number;            // its row in the quiz bank (the whole-syllabus quiz only)
}

/** GET /admin/overview (backend app/services/admin_overview.py). */
export interface AdminKpi {
  value: number | null;        // null: nothing to measure yet (e.g. no trial has ended)
  previous: number | null;     // the same figure one range earlier
  change_pct: number | null;   // null when previous is 0 or unknown
}
export type OverviewDays = 7 | 30 | 90;
export type MediumFilter = "all" | Medium;
export interface AdminOverview {
  range: { days: OverviewDays; medium: MediumFilter; from: string; to: string };
  kpis: Record<"total_students" | "new_signups" | "active_trials" | "paid_subscribers" | "trial_to_paid_pct", AdminKpi>;
  signups_per_day: { date: string; count: number }[];
  latest_signups: {
    id: number; full_name: string; email: string; medium: Medium | null;
    joined_at: string; status: "trial" | "paid" | "expired" | "cancelled";
  }[];
}

/** A question the AI wrote, waiting for an admin's review. */
export interface QuizBankDraft {
  id: number;
  topic: string;
  strand: "pure" | "applied" | null;
  question: string;
  answer: string;
  steps: QuizStep[];
  modelled_on: Partial<TutorSource>;
}

/** GET /admin/quiz-bank (backend app/api/v1/endpoints/admin_quiz.py). */
export interface QuizBankOverview {
  blocked: "job_running" | "daily_set_done" | null;     // why a new set can't start
  job: { id: number; status: "running" | "finished" | "stopped" | "failed"; requested: number;
         added: number; failed: number; started_at: string } | null;
  topics: { key: string; strand: "pure" | "applied"; name: string; published: number; drafts: number }[];
  drafts: QuizBankDraft[];
}

/** A student's report on a practice question (backend app/api/v1/endpoints/admin_feedback.py). */
export interface FeedbackReport {
  id: number;
  kind: FeedbackKind;
  message: string;
  has_image: boolean;
  created_at: string;
  ai: { verdict: "CONFIRMED" | "NOT_CONFIRMED" | "UNSURE"; reason: string } | null;
  question: { topic: string; question: string; answer: string } | null;
}

/** A row of Admin > Students (backend app/services/admin_students.py). */
export interface AdminStudentRow {
  id: number;
  full_name: string;
  email: string;
  mobile: string;
  medium: Medium | null;
  al_exam_year: number | null;
  joined_at: string;
  is_active: boolean;          // false: an admin switched the account off
  plan_state: AdminOverview["latest_signups"][number]["status"];
  questions: number;
  last_active_at: string | null;
}

/** GET /admin/students/{id}: one student's page. */
export interface AdminStudentDetail {
  student: AdminStudentRow & { parent_email: string | null; has_password: boolean; google: boolean };
  progress: Pick<ProgressReport, "has_answers" | "mastery" | "topics_covered" | "accuracy" | "streak" | "weekly" | "topics" | "recent">;
  activity: { start: string; days: { date: string; questions: number; future: boolean }[] }[];   // newest week first
  sessions: { set_id: number; kind: string; lang: Medium; at: string; questions: number; perfect: number; topics: string[] }[];
  subscription: SubscriptionSummary;
}

export const adminApi = {
  students: (q: string, medium: MediumFilter) =>
    request<{ students: AdminStudentRow[]; limit: number }>(
      "GET", `/admin/students?q=${encodeURIComponent(q)}&medium=${medium}`),
  student: (id: number) => request<AdminStudentDetail>("GET", `/admin/students/${id}`),
  setStudentActive: (id: number, active: boolean) =>
    request<{ id: number; is_active: boolean }>("PATCH", `/admin/students/${id}/status`, { active }),
  quizBank: (lang: Medium) => request<QuizBankOverview>("GET", `/admin/quiz-bank?lang=${lang}`),
  generateQuizSet: (lang: Medium) => request<unknown>("POST", "/admin/quiz-bank/generate", { lang }),
  publishDraft: (id: number) => request<unknown>("POST", `/admin/quiz-bank/drafts/${id}/publish`),
  rejectDraft: (id: number) => request<void>("DELETE", `/admin/quiz-bank/drafts/${id}`),
  overview: (days: OverviewDays, medium: MediumFilter) =>
    request<AdminOverview>("GET", `/admin/overview?days=${days}&medium=${medium}`),
  feedback: () => request<{ reports: FeedbackReport[] }>("GET", "/admin/feedback"),
  feedbackImageUrl: (id: number) => `/api/v1/admin/feedback/${id}/image`,
  reviewFeedback: (id: number) => request<FeedbackReport>("POST", `/admin/feedback/${id}/review`),
  closeFeedback: (id: number) => request<unknown>("POST", `/admin/feedback/${id}/close`),
};

/** What the chunker found: `paper`/`part` are null where a chunk had no such heading. */
export interface PaperSection {
  paper: string | null;
  part: string | null;
  chunks: number;
  questions: string[];
}

/** A past paper or marking scheme indexed in the RAG (backend app/services/past_papers.py). */
export interface PaperSummary {
  upload_id: number;
  upload_type: "past_paper" | "marking_scheme";
  exam_year: number | null;
  language: Medium | null;
  title: string | null;
  pages: number;
  chunk_count: number;
  sections: PaperSection[];
}

export interface PaperDetail extends PaperSummary {
  chunks: {
    index: number;
    page: number | null;
    paper: string | null;
    part: string | null;
    question: string | null;
    text: string;
  }[];
}

export const papersApi = {
  list: () => request<{ papers: PaperSummary[] }>("GET", "/papers"),
  read: (uploadId: number) => request<PaperDetail>("GET", `/papers/${uploadId}`),
};

/** One finished question in a practice set. */
export interface AttemptAnswer {
  slot: number;
  topic: string;
  steps_total: number;
  steps_right: number;
}

export type ProgressRange = "7" | "30" | "all";

export interface ProgressWeek {
  start: string;
  questions: number;
  score: number | null;        // null: no practice that week
  accuracy: number | null;
  active_days: number;
}

export interface ProgressTopic {
  key: string;
  strand: "pure" | "applied";
  name: Record<Medium, string>;
  pct: number | null;          // null: not tried in this range
  questions: number;
  steps_right: number;
  steps_total: number;
  last_at: string | null;
}

/** GET /progress/report (backend app/services/progress.py). */
export interface ProgressReport {
  days: number | null;
  has_answers: boolean;
  mastery: { value: number | null; change: number | null };
  topics_covered: { covered: number; total: number };
  accuracy: { value: number | null; questions: number };
  streak: { current: number; best: number };
  weekly: ProgressWeek[];
  daily: { date: string; state: "done" | "missed" | "today" | "before" }[];
  topics: ProgressTopic[];
  recent: {
    set_id: number; kind: "practice"; topic: Record<Medium, string> | null;   // null: mixed topics
    perfect: number; questions: number; at: string;
  }[];
}

/** GET /progress/dashboard: the four home-page cards in one request. */
export interface DashboardSummary {
  has_answers: boolean;
  plan: (ProgressTopic & { reason: "weak" | "new" })[];
  needs_work: ProgressTopic[];
  week: Omit<ProgressWeek, "start"> & {
    start: string;
    streak: number;
    days: { date: string; state: "done" | "missed" | "today" | "future" | "before" }[];   // Mon..Sun
  };
  recent: ProgressReport["recent"];
}

export const progressApi = {
  dashboard: () => request<DashboardSummary>("GET", "/progress/dashboard"),
  saveAttempt: (set_id: number, lang: Medium, answers: AttemptAnswer[]) =>
    request<{ recorded: boolean }>("POST", "/progress/attempts", { set_id, lang, answers }),
  report: (range: ProgressRange) => request<ProgressReport>("GET", `/progress/report?range=${range}`),
};

export type FeedbackKind = "mistake" | "method";

/** A syllabus subject and the student's score in it (GET /quizzes/subjects). */
export interface PracticeSubject {
  key: string;
  strand: "pure" | "applied";
  name: Record<Medium, string>;
  pct: number | null;          // null: not tried yet
  questions: number;
  quizzes: number;             // quizzes taken on this subject
  attempts: { set_id: number; at: string; perfect: number; questions: number; pct: number | null }[];   // newest first
}

/** The whole-syllabus quiz: open to exam-year students, with the questions it would have. */
export interface FullQuizInfo {
  allowed: boolean;
  pure: number;
  applied: number;
}

export const quizzesApi = {
  subjects: (lang: Medium) =>
    request<{ subjects: PracticeSubject[]; full_quiz: FullQuizInfo }>("GET", `/quizzes/subjects?lang=${lang}`),
  /** `image_base64`: the photo's bytes as base64, or null. */
  sendFeedback: (q: QuizQuestion, kind: FeedbackKind, message: string, image_base64: string | null) =>
    request<{ id: number }>("POST", "/quizzes/feedback", {
      kind, message, image_base64, question: { topic: q.topic, question: q.question, answer: q.answer },
    }),
};

export const tutorApi = {
  /** `image`: a data URL attached to the newest message only (the backend never stores it). */
  chat: (history: ChatTurn[], lang: Medium, hint_level: number, mode: TutorMode = "practice", image?: string) =>
    request<TutorReply>("POST", "/tutor/chat", { history, lang, hint_level, mode, image }),
  /** The whole-syllabus quiz: stored questions, avoiding `exclude` (bank ids already seen). */
  fullQuiz: (lang: Medium, exclude: number[]) =>
    request<{ questions: QuizQuestion[] }>("POST", "/tutor/quiz/set", { lang, exclude }),
  /** One new question on a subject, for place `slot` of a quiz, written by the AI now. */
  quizQuestion: (lang: Medium, slot: number, topic: string) =>
    request<{ question: QuizQuestion; model: string }>("POST", "/tutor/quiz/question", { lang, slot, topic }),
};
