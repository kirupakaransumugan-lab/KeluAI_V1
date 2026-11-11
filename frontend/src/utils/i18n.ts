export type Lang = "en" | "ta";

export interface Copy {
  nav: {
    home: string; howItWorks: string; features: string; pricing: string; faq: string; login: string; trial: string; signup: string;
    // Screen-reader labels
    primaryNav: string; mobileNav: string; language: string; menu: string; darkMode: string; lightMode: string;
  };
  trialTerms: string;
  badge: string;
  titleLine1: string;
  titleHighlight: string;
  titleLine3: string;
  subtitle: string[];
  ctaPrimary: string;
  ctaSecondary: string;
  noCard: string;
  cancel: string;
  how: HowCopy;
  features: FeaturesCopy;
  pricing: PricingCopy;
  signup: SignupCopy;
  login: LoginCopy;
  forgot: ForgotCopy;
  dashboard: DashboardCopy;
}

/** Student dashboard. "{n}" is replaced with a number, "{name}" with the student's first name. */
export interface WelcomeCopy {
  hello: string; title: string; subtitle: string; videoTitle: string; videoSoon: string; fullSoon: string;
  steps: { title: string; text: string }[];
  fullTitle: string; fullText: string; fullWatch: string; fullVideoTitle: string; backToMain: string;
  go: string; skip: string; close: string;
  redirect: string; stay: string;
}

export interface DashboardCopy {
  nav: {
    home: string; practice: string; tutor: string; pastPapers: string; progress: string;
    saved: string; subscription: string; settings: string; logout: string;
    // Screen-reader labels
    sidebar: string; openMenu: string; search: string; notifications: string; account: string;
  };
  greeting: { morning: string; afternoon: string; evening: string };
  medium: { ta: string; en: string };
  examYear: string;
  trialDays: string;
  trialLabel: string;
  cheer: string;
  goalEyebrow: string;
  goalTitle: string;
  goalMeta: string;
  startQuiz: string;
  plan: string;
  needsWork: string;
  continueTitle: string;
  thisWeek: string;
  /** Shown while a card has no data in the database yet. */
  empty: Record<"plan" | "needsWork" | "continue" | "week", { title: string; text: string }>;
  /** Home cards once there is data. "{pct}", "{n}", "{p}", "{topic}" are filled in. */
  home: {
    planWeak: string; planNew: string; practice: string;
    topicScore: string;
    allGood: { title: string; text: string };
    questions: string; avgScore: string; streak: string; dayNames: string[];
    quiz: string; mixedQuiz: string; result: string; tutorChat: string; resume: string;
    loadFailed: string; retry: string;
    /** "Start quiz" pressed by a student not yet in their exam year. "{year}" is filled in. */
    fullLock: { title: string; text: string; textNoYear: string; go: string; close: string; checking: string };
  };
  partner: string;
  askPlaceholder: string;
  ask: string;
  voice: string;
  attach: string;
  comingSoon: string;
  comingSoonText: string;
  backHome: string;
  loading: string;
  crashTitle: string;
  crashText: string;
  reload: string;
  tutor: TutorCopy;
  practice: PracticeCopy;
  pastPapers: PastPapersCopy;
  progress: ProgressCopy;
  subscription: SubscriptionCopy;
  welcome: WelcomeCopy;
  settings: SettingsCopy;
}

/** Subscription page. "{n}", "{date}", "{plan}", "{used}", "{total}" are filled in. */
export interface SubscriptionCopy {
  title: string; subtitle: string;
  current: string; yourPlan: string; noPlan: string;
  planNames: Record<"trial" | "free" | "monthly" | "until_exam" | "class" | "annual", string>;
  billing: Record<"free" | "month" | "until_exam" | "student_month", string>;
  status: Record<"trialing" | "active" | "expired" | "cancelled", string>;
  daysLeft: string; endsOn: string; endedOn: string; trialDay: string;
  expiredText: string;
  upgradeTitle: string; upgradeText: string;
  bestValue: string;
  choose: string; soon: string; soonText: string; comparePlans: string;
  history: string; colPlan: string; colStatus: string; colFrom: string; colTo: string;
  loading: string; loadFailed: string; retry: string;
}

/** Settings page. */
export interface SettingsCopy {
  title: string; subtitle: string;
  profile: {
    title: string; text: string; fullName: string; email: string; emailNote: string;
    mobile: string; mobileHelp: string; medium: string; examYear: string;
    parentEmail: string; parentEmailHelp: string; save: string; saved: string;
  };
  password: {
    title: string; text: string; setTitle: string; setText: string;
    current: string; new: string; confirm: string; save: string; saved: string;
  };
  danger: {
    title: string; text: string; open: string; confirmEmail: string; password: string;
    confirm: string; cancel: string;
  };
  errors: {
    name: string; mobile: string; email: string; passwordShort: string; passwordTooLong: string;
    mismatch: string; wrongPassword: string; currentRequired: string; confirmMismatch: string; failed: string;
  };
}

/** Past papers library + reader. "{n}" / "{year}" are filled in. */
export interface PastPapersCopy {
  title: string;
  subtitle: string;
  tabs: { papers: string; topic: string; schemes: string };
  soon: string;
  selectYear: string;
  yearTitle: string;
  kinds: { past_paper: string; marking_scheme: string };
  paper: string;
  part: string;
  page: string;
  pages: string;
  questions: string;
  questionLabel: string;
  sections: string;
  read: string;
  wholeDocument: string;
  schemeOnly: string;
  libraryTitle: string;
  statYears: string;
  statPapers: string;
  statSchemes: string;
  statQuestions: string;
  quickTitle: string;
  random: string;
  askTutor: string;
  loading: string;
  retry: string;
  errorTitle: string;
  errorText: string;
  emptyTitle: string;
  emptyText: string;
  back: string;
  sectionsTitle: string;
  transcribed: string;
  nothingHere: string;
  notFoundTitle: string;
  notFoundText: string;
}

/** Progress report. "{n}" and friends are filled in. */
export interface ProgressCopy {
  title: string;
  subtitle: string;
  rangeLabel: string;
  ranges: { "7": string; "30": string; all: string };
  loading: string;
  retry: string;
  errorTitle: string;
  errorText: string;
  startTitle: string;
  startText: string;
  startAction: string;
  mastery: string;
  masteryChange: string;
  masteryNoChange: string;
  topicsCovered: string;
  topicsLeft: string;
  accuracy: string;
  questionsAnswered: string;
  streak: string;
  streakDays: string;
  streakDay: string;
  streakBest: string;
  weeklyTitle: string;
  weeklyText: string;
  weeklyChange: string;
  weekLabel: string;
  thisWeek: string;
  weekDetail: string;
  noPractice: string;
  dailyTitle: string;
  dailyText: string;
  dailyCount: string;
  dayStates: { done: string; missed: string; today: string; before: string };
  topicsTitle: string;
  topicsText: string;
  pure: string;
  applied: string;
  notTried: string;
  topicNone: string;
  topicSteps: string;
  topicLast: string;
  questionsCount: string;
  appliedNote: string;
  showAll: string;
  showFewer: string;
  recentTitle: string;
  recentText: string;
  recentEmpty: string;
  colType: string;
  colTopic: string;
  colScore: string;
  colDate: string;
  kinds: Record<string, string>;
  mixedTopics: string;
}

/** Practice page. "{n}" / "{total}" / "{pct}" are numbers. */
export interface PracticeCopy {
  title: string;
  subtitle: string;
  tabs: { all: string; topic: string; papers: string; daily: string; saved: string };
  topics: string;
  questionsTitle: string;
  quizTitle: string;
  examNote: string;
  answeredOf: string;          // {n} {total}
  finishQuiz: string;
  unansweredWarn: string;      // {n}
  resultsTitle: string;
  scoreSteps: string;          // {n} {total}
  scoreQuestions: string;      // {n} {total}
  stepsTally: string;          // {n} {total}
  yourAnswer: string;
  correctStep: string;
  notAnswered: string;
  right: string;
  wrong: string;
  viewResults: string;
  closeResults: string;
  close: string;
  resumeTitle: string;
  resumeText: string;          // {n} done of {total}, next question {q}
  resumeBtn: string;
  progress: string;
  steps: string;
  qLabel: string;
  of: string;
  save: string;
  unsave: string;
  hint: string;
  stepHint: string;
  formula: string;
  formulaAsk: string;
  hintsTitle: string;
  noMoreHints: string;
  stepOf: string;
  pickWorking: string;
  check: string;
  correct: string;
  tryAgain: string;
  showAnswer: string;
  answer: string;
  aiLabel: string;
  modelledOn: string;
  previous: string;
  next: string;
  continue: string;
  finish: string;
  doneTitle: string;
  doneText: string;
  newSet: string;
  startTitle: string;
  startText: string;
  start: string;
  generating: string;
  generatingText: string;
  writingNext: string;
  readyCount: string;          // {n} {total}
  dailyTitle: string;
  dailyText: string;
  dailyWarn: string;
  savedEmpty: string;
  savedEmptyText: string;
  remove: string;
  /** Saved tab, now kept on the server. "{n}" / "{date}" are filled in. */
  savedList: {
    count: string; search: string; allTopics: string; noMatch: string; savedOn: string;
    loading: string; loadFailed: string; saveFailed: string; limit: string; retry: string;
  };
  practiceTopic: string;
  fullTitle: string;
  fullText: string;            // {n} {pure} {applied}
  fullLocked: string;
  fullSoon: string;
  newFullQuiz: string;
  mine: { title: string; quizzes: string; history: string; again: string };
  running: {
    title: string; writing: string; writingShort: string; ready: string; answering: string; done: string;
    open: string; continueQuiz: string; browse: string;
  };
  instantNote: string;
  checkAnswer: string;
  levelOf: string;             // {n}
  subjectTitle: string;
  subjectText: string;
  subjectScore: string;
  notTried: string;
  loadingTopics: string;
  pure: string;
  applied: string;
  feedback: {
    open: string; kinds: { mistake: string; method: string }; mistakeLabel: string; methodLabel: string;
    photoLabel: string; photoNote: string; send: string; cancel: string; thanks: string;
    errors: { tooLarge: string; badImage: string; tooMany: string; failed: string };
  };
  errors: { tooMany: string; noFullQuiz: string; fullLocked: string; notIndexed: string; notConfigured: string; failed: string; network: string };
}

/** AI tutor chat. "{n}" / "{max}" are numbers. */
export interface TutorCopy {
  newChat: string;
  search: string;
  groups: { today: string; yesterday: string; week: string; older: string };
  noChats: string;
  noMatches: string;
  savedQuestion: string;
  messages: string;
  bannerTitle: string;
  bannerText: string;
  untitled: string;
  modeChip: string;
  save: string;
  unsave: string;
  more: string;
  deleteChat: string;
  deleteTitle: string;
  deleteText: string;          // {title}
  cancel: string;
  confirmDelete: string;
  toggleChats: string;
  welcomeTitle: string;
  welcomeText: string;
  starters: string[];
  hint: string;
  you: string;
  listen: string;
  stop: string;
  thinking: string;
  nextHint: string;
  iThink: string;
  iThinkPrefill: string;
  similar: string;
  nextHintMessage: string;
  similarMessage: string;
  placeholder: string;
  attach: string;
  attachSoon: string;
  /** Attaching a photo of a question, graph or working. */
  image: { remove: string; onlyMessage: string; historyNote: string; alt: string; dropHere: string };
  voice: string;
  voiceStop: string;
  send: string;
  usage: string;
  limitReached: string;
  disclaimer: string;
  truncated: string;
  retry: string;
  errors: { notConfigured: string; failed: string; network: string; badImage: string; imageTooLarge: string };
}

export interface ForgotCopy {
  titleLead: string;
  titleAccent: string;
  titleTail: string;
  subtitle: string[];
  emailHeading: string;
  emailIntro: string;
  email: string;
  emailPh: string;
  sendCode: string;
  sending: string;
  codeHeading: string;
  /** "{email}" is replaced with the address the code went to. */
  codeIntro: string;
  code: string;
  codePh: string;
  verify: string;
  verifying: string;
  resend: string;
  /** "{s}" is replaced with seconds left. */
  resendIn: string;
  resent: string;
  changeEmail: string;
  passwordHeading: string;
  passwordIntro: string;
  newPassword: string;
  newPasswordPh: string;
  confirmPassword: string;
  confirmPasswordPh: string;
  save: string;
  saving: string;
  doneTitle: string;
  doneText: string;
  doneCta: string;
  backToLogin: string;
  errors: {
    email: string;
    code: string;
    invalidCode: string;
    password: string;
    passwordTooLong: string;
    mismatch: string;
    expired: string;
    network: string;
    generic: string;
  };
}

export interface LoginCopy {
  titleLead: string;
  titleTo: string;
  /** Text after the accent on line 2 (Tamil word order needs it). */
  titleTail: string;
  titleAccent: string;
  subtitle: string[];
  heading: string;
  intro: string;
  email: string;
  emailPh: string;
  password: string;
  passwordPh: string;
  forgot: string;
  submit: string;
  submitting: string;
  orContinue: string;
  google: string;
  microsoft: string;
  socialSoon: string;
  microsoftSoon: string;
  noAccount: string;
  signUp: string;
  errors: { email: string; password: string; invalid: string; disabled: string; network: string; generic: string; google: string; microsoft: string; microsoftUnverified: string };
  /** One-time form after a first Google sign-in (field labels come from SignupCopy). */
  googleProfile: { heading: string; intro: string; submit: string; submitting: string; back: string };
  successTitle: string;
  successText: string;
  successCta: string;
}

export interface SignupCopy {
  badge: string;
  titleLead: string;
  titleAccent: string;
  titleTail: string;
  subtitle: string[];
  perks: { title: string; text: string }[];
  noCard: string;
  formTitle: string;
  fullName: string;
  fullNamePh: string;
  email: string;
  emailPh: string;
  mobile: string;
  mobilePh: string;
  mobileHelp: string;
  password: string;
  passwordPh: string;
  passwordHelp: string;
  showPassword: string;
  hidePassword: string;
  strength: string[];
  medium: string;
  examYear: string;
  examYearPh: string;
  agreeLead: string;
  terms: string;
  and: string;
  privacy: string;
  /** Text after the links (Tamil puts the verb last). */
  agreeTail: string;
  submit: string;
  submitting: string;
  haveAccount: string;
  login: string;
  errors: {
    full_name: string;
    email: string;
    emailTaken: string;
    mobile: string;
    password: string;
    passwordTooLong: string;
    al_exam_year: string;
    accept_terms: string;
    network: string;
    generic: string;
  };
  successTitle: string;
  successText: string;
  successCta: string;
}

export interface PlanCopy {
  name: string;
  tagline: string;
  period: string;
  perks: string[];
  cta: string;
}

export interface PricingCopy {
  badge: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  free: string;
  bestValue: string;
  plans: Record<"free" | "monthly" | "until_exam" | "class", PlanCopy>;   // names/prices: GET /plans
  trust: string[];
}

export interface FeaturesCopy {
  badge: string;
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  items: { title: string; text: string; imageAlt: string }[];
  learnMore: string;
  ctaLine1: string;
  ctaLine2Lead: string;
  ctaLine2Accent: string;
  ctaSub: string;
  ctaButton: string;
}

export interface HowCopy {
  badge: string;
  titleLead: string;
  titleAccent: string;
  titleTail: string;
  subtitle: string;
  steps: { title: string; text: string }[];
  tryBadge: string;
  tryLead: string;
  tryAccent: string;
  trySub: string;
  subject: string;
  topic: string;
  marks: string;
  questionIntro: string;
  partA: string;
  partB: string;
  workingLabel: string;
  workingPlaceholder: string;
  reset: string;
  check: string;
  chooseStep: string;
  chooseStepSub: string;
  hintFor: string;
  nextHint: string;
  noHintYet: string;
  demoSteps: { label: string; hints: string[] }[];
  ctaLead: string;
  ctaAccent: string;
  ctaButton: string;
  perks: string[];
  ctaNote1: string;
  ctaNote2: string;
}

const en: Copy = {
  nav: {
    home: "Home",
    howItWorks: "How it works",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    login: "Log in",
    trial: "Start free trial",
    signup: "Sign up",
    primaryNav: "Primary",
    mobileNav: "Mobile",
    language: "Language",
    darkMode: "Switch to dark mode",
    lightMode: "Switch to light mode",
    menu: "Menu",
  },
  trialTerms: "Trial terms",
  badge: "Better Practice. Higher Results.",
  titleLine1: "Your Personal",
  titleHighlight: "Combined Maths",
  titleLine3: "Tutor, Step by Step.",
  subtitle: [
    "Find your weak topics, practise with hints,",
    "and get your working marked by AI.",
    "In Tamil or English.",
  ],
  ctaPrimary: "Start 14-day free trial",
  ctaSecondary: "See how it looks",
  noCard: "No card needed",
  cancel: "Cancel anytime",
  how: {
    badge: "Simple steps. Big improvement.",
    titleLead: "How",
    titleAccent: "KELU",
    titleTail: "works",
    subtitle: "A clear and simple learning process designed for Sri Lanka A/L Combined Maths.",
    steps: [
      { title: "Take a 20-question diagnostic", text: "Find your current level and identify your weak topics in minutes." },
      { title: "Get your personal study plan", text: "Receive a customised plan based on your strengths and weak topics." },
      { title: "Practise with step-by-step hints", text: "Solve questions with guided hints, not direct answers." },
      { title: "Track your mastery and keep your streak", text: "See your progress, improve over time, and stay motivated with streaks and milestones." },
    ],
    tryBadge: "Try a real question now",
    tryLead: "Give it a",
    tryAccent: "try",
    trySub: "See how KELU gives step-by-step hints for Combined Maths questions. No signup needed.",
    subject: "Combined Maths",
    topic: "Differentiation",
    marks: "5 marks",
    questionIntro: "Given that",
    partA: "find",
    partB: "hence determine the stationary point.",
    workingLabel: "Your working (optional)",
    workingPlaceholder: "Write your working here...",
    reset: "Reset",
    check: "Check my answer",
    chooseStep: "Choose a step to get a hint",
    chooseStepSub: "Select the step you want help with. KELU will give you a guided hint.",
    hintFor: "Hint for Step",
    nextHint: "Next hint",
    noHintYet: "Pick a step above and KELU will nudge you in the right direction.",
    demoSteps: [
      { label: "Find f′(x) using differentiation rules", hints: ["Use the power rule:", "Differentiate each term separately. The derivative of a constant is 0."] },
      { label: "Simplify f′(x)", hints: ["Collect your terms: multiply each coefficient by its power.", "You should end up with a linear expression in x."] },
      { label: "Find the stationary point (set f′(x) = 0)", hints: ["At a stationary point the gradient is zero, so set f′(x) = 0.", "Solve the resulting linear equation for x."] },
      { label: "Find the coordinates of the stationary point", hints: ["Substitute your x-value back into f(x) to get the y-coordinate.", "Write the point as (x, y)."] },
    ],
    ctaLead: "Like this?",
    ctaAccent: "Start your 14-day free trial.",
    ctaButton: "Start free trial",
    perks: ["Full question practice", "Personal study plan", "Track your progress"],
    ctaNote1: "No card needed",
    ctaNote2: "Cancel anytime",
  },
  features: {
    badge: "Everything you need to master Combined Maths.",
    titleLead: "Key",
    titleAccent: "Features",
    subtitle: "Designed for Sri Lanka A/L Combined Maths students, with AI-powered learning support.",
    items: [
      { title: "Hints, not answers", text: "One step at a time, so you actually learn.", imageAlt: "A hint showing the power rule for differentiation" },
      { title: "Upload your handwritten working", text: "AI checks each step against the marking scheme.", imageAlt: "Handwritten working with AI feedback marking each step correct" },
      { title: "AI tutor with voice", text: "Ask questions by typing or speaking.", imageAlt: "A chat with KELU answering a question by voice" },
      { title: "Real past papers", text: "Verified A/L questions and marking schemes.", imageAlt: "A stack of A/L Combined Maths past papers" },
      { title: "Daily quiz and streaks", text: "Small daily practice builds consistency.", imageAlt: "A daily quiz calendar with a 12 day streak" },
      { title: "Save questions", text: "Keep the ones you got wrong and revise later.", imageAlt: "A saved question with a revision note" },
    ],
    learnMore: "Learn more",
    ctaLine1: "Ready to reach your",
    ctaLine2Lead: "maths goals with",
    ctaLine2Accent: "KELU?",
    ctaSub: "Start your 14-day free trial and experience all these features.",
    ctaButton: "Start free trial",
  },
  pricing: {
    badge: "Choose a plan that fits your learning journey.",
    titleLine1: "Simple and Flexible",
    titleLine2: "Plans for Every Student.",
    subtitle: "Get access to AI-powered learning tools designed for Sri Lanka A/L Combined Maths.",
    free: "FREE",
    bestValue: "Best Value",
    plans: {
      free: {
        name: "Free",
        tagline: "Diagnostic, daily quiz and one marked paper a week.",
        period: "always",
        perks: [
          "20-question diagnostic test",
          "Daily quiz and streaks",
          "One marked paper a week",
          "Step-by-step hints",
          "Track your progress",
        ],
        cta: "Start for free",
      },
      monthly: {
        name: "Monthly",
        tagline: "Full tutor, practice and tests; 40 written markings a month.",
        period: "per month",
        perks: [
          "Everything in Free",
          "Full AI tutor with voice (Tamil / English)",
          "Unlimited practice and tests",
          "40 written-answer markings a month",
          "Full past paper library",
          "Save questions and create your own list",
        ],
        cta: "Get Monthly",
      },
      until_exam: {
        name: "Until exam",
        tagline: "About LKR 1,200 a month over ten months.",
        period: "until your A/L exam",
        perks: [
          "Everything in Monthly",
          "Valid until your A/L exam",
          "One payment, nothing to renew",
          "About LKR 1,200 a month over ten months",
          "Track mastery and daily streaks",
        ],
        cta: "Get the Until-exam plan",
      },
      class: {
        name: "Class plan",
        tagline: "For tuition teachers, with a class dashboard.",
        period: "per student a month",
        perks: [
          "For tuition teachers and their classes",
          "Everything in Monthly for each student",
          "Class dashboard to follow every student",
          "Pay only for active students",
        ],
        cta: "Ask about class plans",
      },
    },
    trust: ["Safe and secure payments", "Pay in LKR", "Cancel anytime", "Student friendly pricing", "Support for Tamil and English"],
  },
  signup: {
    badge: "Free 14-day trial",
    titleLead: "Start your",
    titleAccent: "14-day",
    titleTail: "free trial",
    subtitle: ["Your Combined Maths tutor, step by step.", "In Tamil or English."],
    perks: [
      { title: "20-question diagnostic", text: "finds your weak topics" },
      { title: "A personal study plan", text: "that updates as you learn" },
      { title: "Hints, not answers", text: "so you actually learn" },
    ],
    noCard: "No card needed for the trial",
    formTitle: "Create your account",
    fullName: "Full name",
    fullNamePh: "Enter your full name",
    email: "Email",
    emailPh: "you@example.com",
    mobile: "Mobile number",
    mobilePh: "07X XXX XXXX",
    mobileHelp: "Sri Lankan mobile number (07X XXX XXXX)",
    password: "Password",
    passwordPh: "At least 8 characters",
    passwordHelp: "At least 8 characters",
    showPassword: "Show password",
    hidePassword: "Hide password",
    strength: ["Weak", "Fair", "Good", "Strong"],
    medium: "Study medium",
    examYear: "A/L exam year",
    examYearPh: "Select year",
    agreeLead: "I agree to the",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Policy",
    agreeTail: "",
    submit: "Create account",
    submitting: "Creating account…",
    haveAccount: "Already have an account?",
    login: "Log in",
    errors: {
      full_name: "Please enter your full name.",
      email: "Please enter a valid email address.",
      emailTaken: "An account with this email already exists. Try logging in.",
      mobile: "Enter a valid Sri Lankan mobile number (07X XXX XXXX).",
      password: "Password must be at least 8 characters.",
      passwordTooLong: "Password is too long. Please use a shorter one.",
      al_exam_year: "Please select your A/L exam year.",
      accept_terms: "Please agree to the Terms and Privacy Policy.",
      network: "We couldn't reach KELU. Check your connection and try again.",
      generic: "Something went wrong. Please try again.",
    },
    successTitle: "You're in",
    successText: "Your free trial is active until",
    successCta: "Go to my dashboard",
  },
  login: {
    titleLead: "Welcome back",
    titleTo: "to",
    titleTail: "",
    titleAccent: "KELU",
    subtitle: ["Continue your Combined Maths journey.", "Step by step. In Tamil or English."],
    heading: "Log in",
    intro: "Glad to see you again! Continue your learning.",
    email: "Email",
    emailPh: "Enter your email",
    password: "Password",
    passwordPh: "Enter your password",
    forgot: "Forgot password?",
    submit: "Log in",
    submitting: "Logging in…",
    orContinue: "or continue with",
    google: "Continue with Google",
    microsoft: "Continue with Microsoft",
    socialSoon: "Google sign-in is coming soon. Please log in with your email for now.",
    microsoftSoon: "Microsoft sign-in is coming soon. Please use Google or your email for now.",
    noAccount: "Don’t have an account?",
    signUp: "Sign up for free",
    errors: {
      email: "Please enter a valid email address.",
      password: "Please enter your password.",
      invalid: "That email and password don’t match. Please try again.",
      disabled: "This account has been switched off. Please contact KELU support.",
      network: "We couldn't reach KELU. Check your connection and try again.",
      generic: "Something went wrong. Please try again.",
      google: "Google sign-in didn't work. Please try again.",
      microsoft: "Microsoft sign-in didn't work. Please try again.",
      microsoftUnverified: "This Microsoft work or school account can't be used here. Please use a personal Microsoft account (Outlook or Hotmail), or your email.",
    },
    googleProfile: {
      heading: "Almost there",
      intro: "A few details so KELU can set up your study plan.",
      submit: "Start my free trial",
      submitting: "Creating account…",
      back: "Use a different account",
    },
    successTitle: "Welcome back",
    successText: "You're logged in.",
    successCta: "Go to my dashboard",
  },
  forgot: {
    titleLead: "Forgot your",
    titleAccent: "password",
    titleTail: "?",
    subtitle: ["No worries. We'll email you a code", "so you can set a new one."],
    emailHeading: "Reset password",
    emailIntro: "Enter the email you signed up with and we'll send you a 6-digit code.",
    email: "Email",
    emailPh: "Enter your email",
    sendCode: "Send code",
    sending: "Sending…",
    codeHeading: "Check your email",
    codeIntro: "If {email} has a KELU account, we've sent it a 6-digit code. It expires in 15 minutes.",
    code: "Verification code",
    codePh: "6-digit code",
    verify: "Verify code",
    verifying: "Checking…",
    resend: "Resend code",
    resendIn: "Resend code in {s}s",
    resent: "We've sent a new code.",
    changeEmail: "Use a different email",
    passwordHeading: "Set a new password",
    passwordIntro: "Choose a password you haven't used for KELU before.",
    newPassword: "New password",
    newPasswordPh: "At least 8 characters",
    confirmPassword: "Confirm password",
    confirmPasswordPh: "Type it again",
    save: "Save password",
    saving: "Saving…",
    doneTitle: "Password changed",
    doneText: "You're logged in. Other devices have been signed out.",
    doneCta: "Back to home",
    backToLogin: "Back to log in",
    errors: {
      email: "Please enter a valid email address.",
      code: "Enter the 6-digit code from the email.",
      invalidCode: "That code is wrong or has expired. Check the email or send a new code.",
      password: "Password must be at least 8 characters.",
      passwordTooLong: "That password is too long. Please use a shorter one.",
      mismatch: "The passwords don't match.",
      expired: "This reset took too long. Please start again.",
      network: "We couldn't reach KELU. Check your connection and try again.",
      generic: "Something went wrong. Please try again.",
    },
  },
  dashboard: {
    nav: {
      home: "Home", practice: "Practice", tutor: "AI Tutor", pastPapers: "Past Papers", progress: "Progress",
      saved: "Saved Questions", subscription: "Subscription", settings: "Settings", logout: "Log out",
      sidebar: "Dashboard", openMenu: "Open menu", search: "Search", notifications: "Notifications", account: "Account menu",
    },
    greeting: { morning: "Good morning, {name}", afternoon: "Good afternoon, {name}", evening: "Good evening, {name}" },
    medium: { ta: "Tamil medium", en: "English medium" },
    examYear: "A/L {n}",
    trialDays: "{n} days",
    trialLabel: "in free trial",
    cheer: "Let's start learning today! You can do it!",
    goalEyebrow: "Today's goal",
    goalTitle: "Daily quiz · 10 questions",
    goalMeta: "About 15 min · Past-paper style questions",
    startQuiz: "Start quiz",
    plan: "Your study plan",
    needsWork: "Needs work",
    continueTitle: "Continue",
    thisWeek: "This week",
    empty: {
      plan: { title: "No study plan yet", text: "Take your first quiz and KELU will build a plan around the topics you find hardest." },
      needsWork: { title: "No topic scores yet", text: "Answer a few questions and the topics you need to work on will show up here." },
      continue: { title: "Nothing to continue yet", text: "Your tutor chats and saved questions will appear here." },
      week: { title: "No activity this week", text: "Your daily goals, questions answered and average score will be tracked here." },
    },
    home: {
      planWeak: "{pct}% so far · build it up", planNew: "Not tried yet · start here", practice: "Practice",
      topicScore: "{pct}% · {n} questions",
      allGood: { title: "No weak topics right now", text: "Every topic you've tried is at 70% or above. Keep it up!" },
      questions: "Questions", avgScore: "Avg score", streak: "Day streak", dayNames: ["M", "T", "W", "T", "F", "S", "S"],
      quiz: "{topic} quiz", mixedQuiz: "Mixed quiz", result: "{p}/{n} fully right", tutorChat: "Tutor chat", resume: "Resume",
      loadFailed: "Couldn't load your progress.", retry: "Retry",
      fullLock: {
        title: "This quiz is for exam-year students",
        text: "The 10-question full syllabus quiz opens in your exam year, as your A/L exam gets closer ({year}). Until then, build your skills with 5-question topic quizzes in Practice. They climb from easy to hard!",
        textNoYear: "The 10-question full syllabus quiz opens in your exam year. Until then, build your skills with 5-question topic quizzes in Practice. They climb from easy to hard!",
        go: "Go to Practice", close: "Not now", checking: "Checking...",
      },
    },
    partner: "Your AI Maths Partner for A/L Success",
    askPlaceholder: "Ask KELU anything about Combined Maths...",
    ask: "Ask KELU",
    voice: "Ask by voice",
    attach: "Attach your working",
    comingSoon: "Coming soon",
    comingSoonText: "This part of KELU is being built. Check back soon!",
    backHome: "Back to dashboard",
    loading: "Loading your dashboard...",
    crashTitle: "Something went wrong",
    crashText: "This page hit an error. Reloading usually fixes it.",
    reload: "Reload",
    tutor: {
      newChat: "New chat",
      search: "Search conversations...",
      groups: { today: "Today", yesterday: "Yesterday", week: "This week", older: "Earlier" },
      noChats: "No chats yet. Ask your first question!",
      noMatches: "No chats match your search.",
      savedQuestion: "Saved question",
      messages: "{n} messages",
      bannerTitle: "Ask anything, learn step by step!",
      bannerText: "Hints, not answers.",
      untitled: "New chat",
      modeChip: "Hints first · answers from past papers",
      save: "Save this chat",
      unsave: "Remove from saved",
      more: "More options",
      deleteChat: "Delete chat",
      deleteTitle: "Delete this chat?",
      deleteText: "“{title}” will be removed from this device. This can't be undone.",
      cancel: "Cancel",
      confirmDelete: "Delete",
      toggleChats: "Show chats",
      welcomeTitle: "Hi! I'm KELU, your maths tutor.",
      welcomeText: "Tell me which question you're stuck on. I'll give you hints one step at a time, so you learn how to solve it yourself.",
      starters: [
        "How do I start integrating x eˣ dx?",
        "Explain the dot product of two vectors",
        "Help me with 2019 Paper I Part A Q3",
      ],
      hint: "Hint {n} of {max}",
      you: "You",
      listen: "Listen",
      stop: "Stop",
      thinking: "KELU is thinking...",
      nextHint: "Give me the next hint",
      iThink: "I think it's – because...",
      iThinkPrefill: "I think it's  because ",
      similar: "Show me a similar question",
      nextHintMessage: "Give me the next hint, please.",
      similarMessage: "Show me a similar question so I can practise.",
      placeholder: "Type your question or message...",
      attach: "Attach a photo of a question, graph or your working",
      attachSoon: "Attaching your working is coming soon",
      image: {
        remove: "Remove image", onlyMessage: "Please look at this image.",
        historyNote: "[I attached an image]", alt: "Attached image", dropHere: "Drop the image to attach it",
      },
      voice: "Ask by voice",
      voiceStop: "Stop listening",
      send: "Send",
      usage: "{n}/{max} messages used today",
      limitReached: "You've used today's {max} messages. Come back tomorrow!",
      disclaimer: "KELU can make mistakes. Check important steps with your teacher.",
      truncated: "(Reply cut short. Ask me to continue.)",
      retry: "Try again",
      errors: {
        notConfigured: "The tutor isn't set up yet. Please try again later.",
        failed: "I couldn't answer that just now. Please try again.",
        network: "We couldn't reach KELU. Check your connection and try again.",
        badImage: "That file isn't a photo I can read. Use a JPG, PNG or WebP image.",
        imageTooLarge: "That image is too large. Try a smaller photo or a screenshot.",
      },
    },
    pastPapers: {
      title: "Past Papers",
      subtitle: "Browse the real Sri Lankan A/L Combined Mathematics papers in KELU's library.",
      tabs: { papers: "Past Papers", topic: "By Topic", schemes: "Marking Schemes" },
      soon: "Soon",
      selectYear: "Select Year",
      yearTitle: "A/L Combined Mathematics – {year}",
      kinds: { past_paper: "Question paper", marking_scheme: "Marking scheme" },
      paper: "Paper {n}",
      part: "Part {n}",
      page: "Page {n}",
      pages: "{n} pages",
      questions: "{n} questions",
      questionLabel: "Question {n}",
      sections: "Sections: {n}",
      read: "Read",
      wholeDocument: "Whole document",
      schemeOnly: "Only the marking scheme for {year} is in KELU so far. The question paper hasn't been added yet.",
      libraryTitle: "In the Library",
      statYears: "Exam years",
      statPapers: "Question papers",
      statSchemes: "Marking schemes",
      statQuestions: "Questions found",
      quickTitle: "Quick Actions",
      random: "Random paper",
      askTutor: "Ask the AI Tutor",
      loading: "Loading papers…",
      retry: "Try again",
      errorTitle: "We couldn't load the papers",
      errorText: "Please check your connection and try again.",
      emptyTitle: "No papers yet",
      emptyText: "Past papers will appear here once they've been added to KELU.",
      back: "All past papers",
      sectionsTitle: "Sections",
      transcribed: "This text was transcribed automatically, so maths formatting can be lost: for example, x² may appear as x2, and ¼ as 14. Check carefully before relying on a formula.",
      nothingHere: "Nothing was found for this section.",
      notFoundTitle: "Paper not found",
      notFoundText: "This paper isn't in the library.",
    },
    progress: {
      title: "Your progress",
      subtitle: "A clear view of your Combined Maths journey.",
      rangeLabel: "Time range",
      ranges: { "7": "7 days", "30": "30 days", all: "All time" },
      loading: "Loading your progress…",
      retry: "Try again",
      errorTitle: "We couldn't load your progress",
      errorText: "Please check your connection and try again.",
      startTitle: "Your report starts with your first quiz",
      startText: "Finish a practice set and your results will appear here.",
      startAction: "Start practising",
      mastery: "Average mastery",
      masteryChange: "{n} pts vs previous period",
      masteryNoChange: "Across the topics you've tried",
      topicsCovered: "Topics covered",
      topicsLeft: "{n} not tried yet",
      accuracy: "First-try accuracy",
      questionsAnswered: "Questions answered: {n}",
      streak: "Streak",
      streakDays: "{n} days",
      streakDay: "{n} day",
      streakBest: "Best streak: {n}",
      weeklyTitle: "Average score by week",
      weeklyText: "Your average score over the last {n} weeks.",
      weeklyChange: "From {a}% to {b}% over the last {n} weeks.",
      weekLabel: "W{n}",
      thisWeek: "This",
      weekDetail: "{pct}% · Questions: {n}",
      noPractice: "No practice this week",
      dailyTitle: "Daily goal",
      dailyText: "Finish a practice set each day to build consistency.",
      dailyCount: "{n} of {total} days",
      dayStates: { done: "Done", missed: "Missed", today: "Today", before: "Before you joined" },
      topicsTitle: "Mastery by topic",
      topicsText: "Lowest first · select a topic for details.",
      pure: "Pure mathematics",
      applied: "Applied mathematics",
      notTried: "Not tried",
      topicNone: "You haven't practised this topic in this period.",
      topicSteps: "{right} of {total} steps right",
      topicLast: "last on {when}",
      questionsCount: "Questions: {n}",
      appliedNote: "Practise an applied subject to start filling this in.",
      showAll: "Show all {n} topics",
      showFewer: "Show fewer",
      recentTitle: "Recent quizzes",
      recentText: "Your latest quiz attempts.",
      recentEmpty: "Your finished quizzes will be listed here.",
      colType: "Type",
      colTopic: "Topic",
      colScore: "Score",
      colDate: "Date",
      kinds: { practice: "Practice" },
      mixedTopics: "Mixed topics",
    },
    welcome: {
      hello: "Hi {name},",
      title: "Welcome to KELU!",
      subtitle: "Your AI tutor for A/L Combined Mathematics. Watch this short video to see how it works.",
      videoTitle: "How to use KELU",
      videoSoon: "The video is coming soon. Here is what you can do:",
      fullSoon: "This video is coming soon. You can already start the quiz from your Practice page.",
      steps: [
        { title: "Ask the AI tutor", text: "Type a question or send a photo. You get hints step by step, from real past papers." },
        { title: "Practise by subject", text: "Pick a topic and solve 5 questions, from easy to hard, with guided steps." },
        { title: "Build your streak", text: "Practise every day and watch your progress and weak topics improve." },
      ],
      fullTitle: "Full syllabus quiz is open for you",
      fullText: "You are in your exam year, so you can take the 10-question quiz covering the whole syllabus.",
      fullWatch: "Watch how it works",
      fullVideoTitle: "The full syllabus quiz",
      backToMain: "Back to the welcome video",
      go: "Go to my dashboard",
      skip: "Skip intro",
      close: "Close",
      redirect: "Taking you to your dashboard in {n}...",
      stay: "Stay here",
    },
    subscription: {
      title: "Subscription", subtitle: "Your plan, trial days and plan history.",
      current: "Current plan", yourPlan: "Your plan", noPlan: "No plan yet",
      planNames: { trial: "Free Trial", free: "Free", monthly: "Monthly", until_exam: "Until exam", class: "Class plan", annual: "Annual" },
      billing: { free: "always", month: "/ month", until_exam: "until your A/L exam", student_month: "per student a month" },
      status: { trialing: "Trial", active: "Active", expired: "Expired", cancelled: "Cancelled" },
      daysLeft: "{n} days left", endsOn: "Ends {date}", endedOn: "Ended {date}", trialDay: "Day {used} of {total}",
      expiredText: "Your plan has ended. Choose a plan to keep full access.",
      upgradeTitle: "Upgrade for full access", upgradeText: "Unlimited practice, AI marking and the full past paper library.",
      bestValue: "Best value",
      choose: "Choose {plan}", soon: "Online payment coming soon",
      soonText: "Payments in LKR are being set up. Your trial keeps working until then.", comparePlans: "Compare all plans",
      history: "Plan history", colPlan: "Plan", colStatus: "Status", colFrom: "From", colTo: "To",
      loading: "Loading your plan...", loadFailed: "Couldn't load your plan.", retry: "Retry",
    },
    settings: {
      title: "Settings", subtitle: "Manage your profile, password and account.",
      profile: {
        title: "Profile", text: "This is how KELU knows you and sets up your practice.",
        fullName: "Full name", email: "Email", emailNote: "Your email can't be changed here.",
        mobile: "Mobile number", mobileHelp: "Sri Lankan mobile number (07X XXX XXXX)",
        medium: "Study medium", examYear: "A/L exam year",
        parentEmail: "Parent or guardian email", parentEmailHelp: "Optional. Leave empty if you don't want to add one.",
        save: "Save changes", saved: "Profile saved.",
      },
      password: {
        title: "Password", text: "Changing your password signs you out on your other devices.",
        setTitle: "Set a password", setText: "You sign in with Google. Set a password to also log in with your email.",
        current: "Current password", new: "New password", confirm: "Confirm new password",
        save: "Update password", saved: "Password updated. Your other devices have been signed out.",
      },
      danger: {
        title: "Delete account",
        text: "This permanently deletes your account, progress, saved questions and plan. It can't be undone.",
        open: "Delete my account", confirmEmail: "Type your email ({email}) to confirm", password: "Your password",
        confirm: "Permanently delete", cancel: "Cancel",
      },
      errors: {
        name: "Enter your full name.", mobile: "Enter a valid Sri Lankan mobile number.", email: "Enter a valid email.",
        passwordShort: "Use at least 8 characters.", passwordTooLong: "That password is too long.",
        mismatch: "The passwords don't match.", wrongPassword: "That password isn't right.", currentRequired: "Enter your current password.",
        confirmMismatch: "That email doesn't match your account.", failed: "Something went wrong. Please try again.",
      },
    },
    practice: {
      title: "Practice",
      subtitle: "Click a topic and work through 5 new questions, from easy to hard.",
      tabs: { all: "Practice", topic: "By Topic", papers: "Past Papers", daily: "Daily Quiz", saved: "Saved Questions" },
      topics: "Topics",
      questionsTitle: "Practice Questions",
      quizTitle: "Practice quiz",
      examNote: "Pick the correct working for each step. Answers are shown after you finish all the questions.",
      answeredOf: "{n} / {total} answered",
      finishQuiz: "Finish quiz",
      unansweredWarn: "{n} steps are not answered yet. They will count as wrong.",
      resultsTitle: "Your results",
      scoreSteps: "{n} of {total} steps correct",
      scoreQuestions: "{n} of {total} questions fully correct",
      stepsTally: "{n} / {total} steps",
      yourAnswer: "Your answer",
      correctStep: "Correct step",
      notAnswered: "Not answered",
      right: "Correct",
      wrong: "Incorrect",
      viewResults: "View results",
      closeResults: "Close",
      close: "Close quiz",
      resumeTitle: "Your quiz is waiting",
      resumeText: "{n} of {total} questions done. Pick up at question {q}, or choose a topic.",
      resumeBtn: "Continue quiz",
      progress: "{n} / {total} questions",
      steps: "{n} / {total} steps",
      qLabel: "Q. {n}",
      of: "{n} of {total}",
      save: "Save question",
      unsave: "Remove from saved",
      hint: "Hint",
      stepHint: "Step Hint",
      formula: "Formula",
      formulaAsk: "Which formulas or results do I need for this question? Don't solve it for me.\n\n{q}",
      hintsTitle: "Hints",
      noMoreHints: "That's every hint. Try Step Hint to work through it.",
      stepOf: "Step {n} of {total}",
      pickWorking: "Pick the correct working for this step:",
      check: "Check",
      correct: "Correct!",
      tryAgain: "Not quite. Read why, then try again.",
      showAnswer: "Show answer",
      answer: "Answer",
      aiLabel: "Practice question (AI-generated)",
      modelledOn: "In the style of {src}",
      previous: "Previous",
      next: "Next",
      continue: "Continue Practice",
      finish: "Finish",
      doneTitle: "Set complete!",
      doneText: "You worked through {n} of {total} questions. Start a new set to keep going.",
      newSet: "New quiz on this subject",
      startTitle: "Ready to practise?",
      startText: "KELU writes 10 new questions in the style of real A/L Paper I Part A questions. Work through each one step by step.",
      start: "Start practice",
      generating: "Writing your questions...",
      generatingText: "KELU is writing your 5 questions. The first appears in a minute or two. You can browse other topics meanwhile: this quiz keeps being written.",
      writingNext: "Writing the next question...",
      readyCount: "{n} of {total} ready",
      dailyTitle: "Daily quiz · 10 questions",
      dailyText: "A fresh set of 10 past-paper style questions.",
      dailyWarn: "This replaces your current set.",
      savedEmpty: "No saved questions yet",
      savedEmptyText: "Tap the bookmark on any question to keep it here.",
      remove: "Remove",
      savedList: {
        count: "{n} saved", search: "Search saved questions...", allTopics: "All topics",
        noMatch: "No saved questions match.", savedOn: "Saved {date}", loading: "Loading your saved questions...",
        loadFailed: "Couldn't load your saved questions.", saveFailed: "Couldn't update your saved questions. Try again.",
        limit: "You've reached the saved-question limit. Remove some to save more.", retry: "Retry",
      },
      practiceTopic: "Practise this topic",
      fullTitle: "Full syllabus quiz",
      fullText: "{n} questions across the whole syllabus: {pure} Pure and {applied} Applied. Ready straight away.",
      fullLocked: "This opens in your exam year, once you've covered the whole syllabus.",
      fullSoon: "Questions for this quiz are being prepared. Please check back soon.",
      newFullQuiz: "New full syllabus quiz",
      mine: { title: "Your topics", quizzes: "Quizzes taken: {n}", history: "Recent quizzes", again: "New quiz" },
      running: {
        title: "Your quizzes",
        writing: "Writing questions… {n} of {total} ready",
        writingShort: "Writing… {n}/{total}",
        ready: "Ready to start",
        answering: "{n} of {total} answered",
        done: "Finished: {pct}%",
        open: "Open",
        continueQuiz: "Continue",
        browse: "Browse other topics",
      },
      instantNote: "Pick the correct working for each step, then check your answer.",
      checkAnswer: "Check answer",
      levelOf: "Level {n} of 5",
      subjectTitle: "Choose a subject",
      subjectText: "Click a topic to start. Its 5 questions, from easy to hard, are written while you keep browsing; open it when it says ready.",
      subjectScore: "Your score: {pct}%",
      notTried: "Not tried yet",
      loadingTopics: "Loading subjects…",
      pure: "Pure mathematics",
      applied: "Applied mathematics",
      feedback: {
        open: "Report a mistake or share another method",
        kinds: { mistake: "Found a mistake", method: "Another method" },
        mistakeLabel: "What's wrong, and what do you think is right?",
        methodLabel: "How did you solve it?",
        photoLabel: "Photo of your working (optional)",
        photoNote: "KELU staff see your message and photo, and an AI service may help check them. The photo is deleted after review. Please don't include your name or other personal details.",
        send: "Send",
        cancel: "Cancel",
        thanks: "Thank you! KELU will check this.",
        errors: {
          tooLarge: "That photo is too big. Please use one under 5 MB.",
          badImage: "Please use a PNG, JPG or WebP photo.",
          tooMany: "You've sent a lot of reports today. Please try again tomorrow.",
          failed: "That didn't send. Please try again.",
        },
      },
      errors: {
        tooMany: "Up to {n} quizzes can be written at once. Open one that's ready, or wait a moment.",
        noFullQuiz: "Questions for this quiz aren't ready yet. Please check back soon.",
        fullLocked: "The full syllabus quiz opens in your exam year.",
        notIndexed: "Past papers haven't been loaded yet, so KELU can't write questions. Please try again later.",
        notConfigured: "Practice isn't set up yet. Please try again later.",
        failed: "Couldn't write your questions just now. Please try again.",
        network: "We couldn't reach KELU. Check your connection and try again.",
      },
    },
  },
};

// Tamil copy (Sri Lankan Tamil, A/L syllabus terms: இணைந்த கணிதம், வகையிடல், நிலைப்புள்ளி,
// புள்ளித் திட்டம், மொழிமூலம்). Typed as a full Copy so a missing string fails the build
// instead of silently showing English. Should be reviewed by a Tamil-medium teacher before launch.
const ta: Copy = {
  nav: {
    home: "முகப்பு",
    howItWorks: "எப்படி செயல்படுகிறது",
    features: "சிறப்பம்சங்கள்",
    pricing: "கட்டணம்",
    faq: "கேள்வி-பதில்",
    login: "உள்நுழை",
    trial: "இலவசமாகத் தொடங்கு",
    signup: "பதிவு செய்",
    primaryNav: "முதன்மை",
    mobileNav: "கைபேசி",
    language: "மொழி",
    darkMode: "இருண்ட பயன்முறைக்கு மாறு",
    lightMode: "ஒளி பயன்முறைக்கு மாறு",
    menu: "பட்டியல்",
  },
  trialTerms: "இலவச சோதனை நிபந்தனைகள்",
  badge: "சிறந்த பயிற்சி. உயர்ந்த பெறுபேறுகள்.",
  titleLine1: "உங்கள் தனிப்பட்ட",
  titleHighlight: "இணைந்த கணித",
  titleLine3: "ஆசிரியர், படிப்படியாக.",
  subtitle: [
    "உங்கள் பலவீனமான பாடப்பகுதிகளைக் கண்டறிந்து, குறிப்புகளுடன் பயிற்சி செய்து,",
    "உங்கள் விடைகளை AI மூலம் மதிப்பிடுங்கள்.",
    "தமிழிலும் ஆங்கிலத்திலும்.",
  ],
  ctaPrimary: "14 நாள் இலவச சோதனையைத் தொடங்கு",
  ctaSecondary: "எப்படி இருக்கும் எனப் பாருங்கள்",
  noCard: "அட்டை தேவையில்லை",
  cancel: "எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்",
  how: {
    badge: "எளிய படிகள். பெரிய முன்னேற்றம்.",
    titleLead: "",
    titleAccent: "KELU",
    titleTail: "எப்படி செயல்படுகிறது",
    subtitle: "இலங்கை க.பொ.த உயர்தர இணைந்த கணிதத்திற்காக வடிவமைக்கப்பட்ட தெளிவான, எளிய கற்றல் முறை.",
    steps: [
      { title: "20 வினாக்கள் கொண்ட கண்டறிதல் சோதனை", text: "சில நிமிடங்களில் உங்கள் தற்போதைய நிலையையும் பலவீனமான பாடப்பகுதிகளையும் கண்டறியுங்கள்." },
      { title: "உங்களுக்கான கற்றல் திட்டம்", text: "உங்கள் பலம் மற்றும் பலவீனங்களின் அடிப்படையில் தயாரிக்கப்பட்ட திட்டத்தைப் பெறுங்கள்." },
      { title: "படிப்படியான குறிப்புகளுடன் பயிற்சி", text: "நேரடி விடைகள் அல்ல, வழிகாட்டும் குறிப்புகளுடன் வினாக்களைத் தீர்க்கவும்." },
      { title: "தேர்ச்சியைக் கண்காணித்து தொடர்ந்து பயிலுங்கள்", text: "உங்கள் முன்னேற்றத்தைப் பாருங்கள்; தொடர் நாட்களும் இலக்குகளும் உங்களை ஊக்குவிக்கும்." },
    ],
    tryBadge: "இப்போதே ஒரு உண்மையான வினாவை முயலுங்கள்",
    tryLead: "ஒருமுறை",
    tryAccent: "முயன்று பாருங்கள்",
    trySub: "இணைந்த கணித வினாக்களுக்கு KELU எவ்வாறு படிப்படியான குறிப்புகளைத் தருகிறது எனப் பாருங்கள். பதிவு தேவையில்லை.",
    subject: "இணைந்த கணிதம்",
    topic: "வகையிடல்",
    marks: "5 புள்ளிகள்",
    questionIntro: "தரப்பட்டுள்ளது:",
    partA: "காண்க:",
    partB: "இதிலிருந்து நிலைப்புள்ளியைக் காண்க.",
    workingLabel: "உங்கள் செய்கை (விரும்பினால்)",
    workingPlaceholder: "உங்கள் செய்கையை இங்கே எழுதுங்கள்...",
    reset: "மீளமை",
    check: "என் விடையைச் சரிபார்",
    chooseStep: "குறிப்பு பெற ஒரு படியைத் தெரிவுசெய்யுங்கள்",
    chooseStepSub: "உதவி தேவைப்படும் படியைத் தெரிவுசெய்யுங்கள். KELU வழிகாட்டும் குறிப்பைத் தரும்.",
    hintFor: "குறிப்பு — படி",
    nextHint: "அடுத்த குறிப்பு",
    noHintYet: "மேலே ஒரு படியைத் தெரிவுசெய்யுங்கள்; KELU சரியான திசையில் வழிகாட்டும்.",
    demoSteps: [
      { label: "வகையிடல் விதிகளைப் பயன்படுத்தி f′(x) ஐக் காண்க", hints: ["அடுக்கு விதியைப் பயன்படுத்துங்கள்:", "ஒவ்வொரு உறுப்பையும் தனித்தனியாக வகையிடுங்கள். மாறிலியின் வகையீடு 0 ஆகும்."] },
      { label: "f′(x) ஐச் சுருக்குக", hints: ["உறுப்புகளைச் சேருங்கள்: ஒவ்வொரு குணகத்தையும் அதன் அடுக்கால் பெருக்குங்கள்.", "x இல் ஒரு நேரியல் கோவை கிடைக்க வேண்டும்."] },
      { label: "நிலைப்புள்ளியைக் காண்க (f′(x) = 0 என இடுக)", hints: ["நிலைப்புள்ளியில் படித்திறன் பூச்சியம், எனவே f′(x) = 0 என இடுங்கள்.", "கிடைக்கும் நேரியல் சமன்பாட்டை x இற்குத் தீர்க்கவும்."] },
      { label: "நிலைப்புள்ளியின் ஆள்கூறுகளைக் காண்க", hints: ["y ஆள்கூற்றைப் பெற உங்கள் x பெறுமானத்தை f(x) இல் பிரதியிடுங்கள்.", "புள்ளியை (x, y) என எழுதுங்கள்."] },
    ],
    ctaLead: "பிடித்திருக்கிறதா?",
    ctaAccent: "14 நாள் இலவச சோதனையைத் தொடங்குங்கள்.",
    ctaButton: "இலவசமாகத் தொடங்கு",
    perks: ["முழுமையான வினாப் பயிற்சி", "தனிப்பட்ட கற்றல் திட்டம்", "முன்னேற்றக் கண்காணிப்பு"],
    ctaNote1: "அட்டை தேவையில்லை",
    ctaNote2: "எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்",
  },
  features: {
    badge: "இணைந்த கணிதத்தில் தேர்ச்சி பெறத் தேவையான அனைத்தும்.",
    titleLead: "முக்கிய",
    titleAccent: "சிறப்பம்சங்கள்",
    subtitle: "இலங்கை க.பொ.த உயர்தர இணைந்த கணித மாணவர்களுக்காக, AI துணையுடன் வடிவமைக்கப்பட்டது.",
    items: [
      { title: "விடைகள் அல்ல, குறிப்புகள்", text: "ஒவ்வொரு படியாக — நீங்களே உண்மையாகக் கற்றுக்கொள்ள.", imageAlt: "வகையிடலுக்கான அடுக்கு விதியைக் காட்டும் குறிப்பு" },
      { title: "கையால் எழுதிய செய்கையைப் பதிவேற்றுங்கள்", text: "ஒவ்வொரு படியையும் AI புள்ளித் திட்டத்துடன் ஒப்பிட்டுச் சரிபார்க்கும்.", imageAlt: "ஒவ்வொரு படியும் சரி எனக் குறிக்கப்பட்ட கையெழுத்துச் செய்கை" },
      { title: "குரல் வசதியுடன் AI ஆசிரியர்", text: "தட்டச்சு செய்தோ பேசியோ கேள்வி கேளுங்கள்.", imageAlt: "குரல் மூலம் கேள்விக்குப் பதிலளிக்கும் KELU உரையாடல்" },
      { title: "உண்மையான கடந்தகால வினாத்தாள்கள்", text: "சரிபார்க்கப்பட்ட உயர்தர வினாக்களும் புள்ளித் திட்டங்களும்.", imageAlt: "உயர்தர இணைந்த கணிதக் கடந்தகால வினாத்தாள்கள்" },
      { title: "தினசரி வினாடி வினாவும் தொடர் நாட்களும்", text: "சிறு தினசரிப் பயிற்சி நிலையான முன்னேற்றத்தைத் தரும்.", imageAlt: "12 நாள் தொடருடன் தினசரி வினாடி வினா நாட்காட்டி" },
      { title: "வினாக்களைச் சேமியுங்கள்", text: "தவறிய வினாக்களைச் சேமித்துப் பின்னர் மீட்டல் செய்யுங்கள்.", imageAlt: "மீட்டல் குறிப்புடன் சேமிக்கப்பட்ட வினா" },
    ],
    learnMore: "மேலும் அறிக",
    ctaLine1: "உங்கள் கணித இலக்குகளை",
    ctaLine2Lead: "அடையத் தயாரா —",
    ctaLine2Accent: "KELU உடன்?",
    ctaSub: "14 நாள் இலவச சோதனையைத் தொடங்கி இந்த அனைத்துச் சிறப்பம்சங்களையும் அனுபவியுங்கள்.",
    ctaButton: "இலவசமாகத் தொடங்கு",
  },
  pricing: {
    badge: "உங்கள் கற்றல் பயணத்துக்கு ஏற்ற திட்டத்தைத் தெரிவுசெய்யுங்கள்.",
    titleLine1: "எளிமையான, நெகிழ்வான",
    titleLine2: "அனைவருக்குமான திட்டங்கள்.",
    subtitle: "இலங்கை க.பொ.த உயர்தர இணைந்த கணிதத்திற்காக வடிவமைக்கப்பட்ட AI கற்றல் கருவிகளைப் பெறுங்கள்.",
    free: "இலவசம்",
    bestValue: "சிறந்த பெறுமதி",
    plans: {
      free: {
        name: "இலவசம்",
        tagline: "ஆரம்ப மதிப்பீடு, தினசரி வினாடி வினா, வாரத்துக்கு ஒரு திருத்திய வினாத்தாள்.",
        period: "எப்போதும்",
        perks: [
          "20 வினாக்கள் கொண்ட கண்டறிதல் சோதனை",
          "தினசரி வினாடி வினாவும் தொடர் நாட்களும்",
          "வாரத்துக்கு ஒரு திருத்திய வினாத்தாள்",
          "படிப்படியான குறிப்புகள்",
          "முன்னேற்றக் கண்காணிப்பு",
        ],
        cta: "இலவசமாகத் தொடங்கு",
      },
      monthly: {
        name: "மாதாந்தம்",
        tagline: "முழு AI ஆசிரியர், பயிற்சி, பரீட்சைகள்; மாதம் 40 எழுத்து விடைத் திருத்தங்கள்.",
        period: "மாதத்துக்கு",
        perks: [
          "இலவசத் திட்டத்தில் உள்ள அனைத்தும்",
          "குரல் வசதியுடன் முழு AI ஆசிரியர் (தமிழ் / ஆங்கிலம்)",
          "வரம்பற்ற பயிற்சியும் பரீட்சைகளும்",
          "மாதம் 40 எழுத்து விடைத் திருத்தங்கள்",
          "முழுமையான கடந்தகால வினாத்தாள் தொகுப்பு",
          "வினாக்களைச் சேமித்து உங்கள் சொந்தப் பட்டியலை உருவாக்குங்கள்",
        ],
        cta: "மாதாந்தத் திட்டத்தைப் பெறுங்கள்",
      },
      until_exam: {
        name: "பரீட்சை வரை",
        tagline: "பத்து மாதங்களுக்கு மாதம் சுமார் LKR 1,200.",
        period: "உங்கள் A/L பரீட்சை வரை",
        perks: [
          "மாதாந்தத் திட்டத்தில் உள்ள அனைத்தும்",
          "உங்கள் A/L பரீட்சை வரை செல்லுபடியாகும்",
          "ஒரே கட்டணம், புதுப்பிக்கத் தேவையில்லை",
          "பத்து மாதங்களுக்கு மாதம் சுமார் LKR 1,200",
          "தேர்ச்சியும் தினசரித் தொடர் நாட்களும்",
        ],
        cta: "பரீட்சை வரையான திட்டத்தைப் பெறுங்கள்",
      },
      class: {
        name: "வகுப்புத் திட்டம்",
        tagline: "தனியார் வகுப்பு ஆசிரியர்களுக்கு, வகுப்பு முகாமைத்துவப் பலகையுடன்.",
        period: "ஒரு மாணவருக்கு மாதத்துக்கு",
        perks: [
          "தனியார் வகுப்பு ஆசிரியர்களுக்கும் அவர்களின் வகுப்புகளுக்கும்",
          "ஒவ்வொரு மாணவருக்கும் மாதாந்தத் திட்டத்தின் அனைத்தும்",
          "ஒவ்வொரு மாணவரையும் கண்காணிக்க வகுப்புப் பலகை",
          "செயலில் உள்ள மாணவர்களுக்கு மட்டும் கட்டணம்",
        ],
        cta: "வகுப்புத் திட்டம் பற்றிக் கேளுங்கள்",
      },
    },
    trust: ["பாதுகாப்பான கொடுப்பனவுகள்", "இலங்கை ரூபாயில் செலுத்தலாம்", "எப்போது வேண்டுமானாலும் ரத்து செய்யலாம்", "மாணவர்களுக்கு ஏற்ற கட்டணம்", "தமிழ், ஆங்கில மொழி ஆதரவு"],
  },
  signup: {
    badge: "14 நாள் இலவச சோதனை",
    titleLead: "இன்றே தொடங்குங்கள்",
    titleAccent: "14 நாள்",
    titleTail: "இலவசம்!",
    subtitle: ["உங்கள் இணைந்த கணித ஆசிரியர், படிப்படியாக.", "தமிழிலும் ஆங்கிலத்திலும்."],
    perks: [
      { title: "20 வினாக் கண்டறிதல் சோதனை", text: "உங்கள் பலவீனமான பகுதிகளைக் கண்டறியும்" },
      { title: "உங்களுக்கான கற்றல் திட்டம்", text: "நீங்கள் கற்கும்போது புதுப்பிக்கப்படும்" },
      { title: "விடைகள் அல்ல, குறிப்புகள்", text: "நீங்களே உண்மையாகக் கற்றுக்கொள்ள" },
    ],
    noCard: "இலவச சோதனைக்கு அட்டை தேவையில்லை",
    formTitle: "கணக்கை உருவாக்குங்கள்",
    fullName: "முழுப் பெயர்",
    fullNamePh: "உங்கள் முழுப் பெயர்",
    email: "மின்னஞ்சல்",
    emailPh: "you@example.com",
    mobile: "கைபேசி இலக்கம்",
    mobilePh: "07X XXX XXXX",
    mobileHelp: "இலங்கைக் கைபேசி இலக்கம் (07X XXX XXXX)",
    password: "கடவுச்சொல்",
    passwordPh: "குறைந்தது 8 எழுத்துகள்",
    passwordHelp: "குறைந்தது 8 எழுத்துகள்",
    showPassword: "கடவுச்சொல்லைக் காட்டு",
    hidePassword: "கடவுச்சொல்லை மறை",
    strength: ["பலவீனம்", "சுமார்", "நன்று", "வலிமை"],
    medium: "கற்கை மொழிமூலம்",
    examYear: "உயர்தரப் பரீட்சை ஆண்டு",
    examYearPh: "ஆண்டைத் தெரிவுசெய்க",
    agreeLead: "",
    terms: "விதிமுறைகள்",
    and: "மற்றும்",
    privacy: "தனியுரிமைக் கொள்கை",
    agreeTail: "ஆகியவற்றை ஏற்கிறேன்",
    submit: "கணக்கை உருவாக்கு",
    submitting: "கணக்கு உருவாக்கப்படுகிறது…",
    haveAccount: "ஏற்கனவே கணக்கு உள்ளதா?",
    login: "உள்நுழை",
    errors: {
      full_name: "உங்கள் முழுப் பெயரை உள்ளிடுங்கள்.",
      email: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்.",
      emailTaken: "இந்த மின்னஞ்சலுடன் ஏற்கனவே ஒரு கணக்கு உள்ளது. உள்நுழைய முயலுங்கள்.",
      mobile: "சரியான இலங்கைக் கைபேசி இலக்கத்தை உள்ளிடுங்கள் (07X XXX XXXX).",
      password: "கடவுச்சொல் குறைந்தது 8 எழுத்துகள் கொண்டிருக்க வேண்டும்.",
      passwordTooLong: "கடவுச்சொல் மிக நீளமானது. சிறியதொன்றைப் பயன்படுத்துங்கள்.",
      al_exam_year: "உங்கள் உயர்தரப் பரீட்சை ஆண்டைத் தெரிவுசெய்யுங்கள்.",
      accept_terms: "விதிமுறைகளையும் தனியுரிமைக் கொள்கையையும் ஏற்றுக்கொள்ளுங்கள்.",
      network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
      generic: "ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயலுங்கள்.",
    },
    successTitle: "வரவேற்கிறோம்",
    successText: "உங்கள் இலவச சோதனை முடியும் நாள்:",
    successCta: "என் பலகைக்குச் செல்",
  },
  login: {
    titleLead: "மீண்டும் வருக!",
    titleTo: "",
    titleAccent: "KELU",
    titleTail: " வரவேற்கிறது",
    subtitle: ["உங்கள் இணைந்த கணிதப் பயணத்தைத் தொடருங்கள்.", "படிப்படியாக. தமிழிலும் ஆங்கிலத்திலும்."],
    heading: "உள்நுழைக",
    intro: "மீண்டும் சந்தித்ததில் மகிழ்ச்சி! உங்கள் கற்றலைத் தொடருங்கள்.",
    email: "மின்னஞ்சல்",
    emailPh: "உங்கள் மின்னஞ்சலை உள்ளிடுங்கள்",
    password: "கடவுச்சொல்",
    passwordPh: "உங்கள் கடவுச்சொல்லை உள்ளிடுங்கள்",
    forgot: "கடவுச்சொல் மறந்துவிட்டதா?",
    submit: "உள்நுழை",
    submitting: "உள்நுழைகிறது…",
    orContinue: "அல்லது இதன் மூலம் தொடருங்கள்",
    google: "Google மூலம் தொடருங்கள்",
    microsoft: "Microsoft மூலம் தொடருங்கள்",
    socialSoon: "Google மூலம் உள்நுழைவு விரைவில் வரும். இப்போதைக்கு மின்னஞ்சல் மூலம் உள்நுழையுங்கள்.",
    microsoftSoon: "Microsoft மூலம் உள்நுழைவு விரைவில் வரும். இப்போதைக்கு Google அல்லது மின்னஞ்சலைப் பயன்படுத்துங்கள்.",
    noAccount: "கணக்கு இல்லையா?",
    signUp: "இலவசமாகப் பதிவு செய்யுங்கள்",
    errors: {
      email: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்.",
      password: "உங்கள் கடவுச்சொல்லை உள்ளிடுங்கள்.",
      invalid: "மின்னஞ்சலும் கடவுச்சொல்லும் பொருந்தவில்லை. மீண்டும் முயலுங்கள்.",
      disabled: "இந்தக் கணக்கு நிறுத்தி வைக்கப்பட்டுள்ளது. KELU உதவிக் குழுவைத் தொடர்புகொள்ளுங்கள்.",
      network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
      generic: "ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயலுங்கள்.",
      google: "Google மூலம் உள்நுழைய முடியவில்லை. மீண்டும் முயலுங்கள்.",
      microsoft: "Microsoft மூலம் உள்நுழைய முடியவில்லை. மீண்டும் முயலுங்கள்.",
      microsoftUnverified: "இந்த Microsoft பணி அல்லது பாடசாலைக் கணக்கை இங்கு பயன்படுத்த முடியாது. தனிப்பட்ட Microsoft கணக்கையோ (Outlook, Hotmail) மின்னஞ்சலையோ பயன்படுத்துங்கள்.",
    },
    googleProfile: {
      heading: "இன்னும் சிறிது",
      intro: "உங்கள் கற்றல் திட்டத்தை அமைக்க KELU-க்குச் சில விவரங்கள் தேவை.",
      submit: "இலவச சோதனையைத் தொடங்கு",
      submitting: "கணக்கு உருவாக்கப்படுகிறது…",
      back: "வேறு கணக்கைப் பயன்படுத்து",
    },
    successTitle: "மீண்டும் வருக",
    successText: "நீங்கள் உள்நுழைந்துவிட்டீர்கள்.",
    successCta: "என் பலகைக்குச் செல்",
  },
  forgot: {
    titleLead: "உங்கள்",
    titleAccent: "கடவுச்சொல்",
    titleTail: " மறந்துவிட்டதா?",
    subtitle: ["கவலை வேண்டாம். புதிய கடவுச்சொல்லை அமைக்க", "உங்களுக்கு ஒரு குறியீட்டை மின்னஞ்சல் செய்வோம்."],
    emailHeading: "கடவுச்சொல்லை மீட்டமை",
    emailIntro: "பதிவு செய்த மின்னஞ்சலை உள்ளிடுங்கள்; 6 இலக்கக் குறியீட்டை அனுப்புவோம்.",
    email: "மின்னஞ்சல்",
    emailPh: "உங்கள் மின்னஞ்சலை உள்ளிடுங்கள்",
    sendCode: "குறியீட்டை அனுப்பு",
    sending: "அனுப்புகிறது…",
    codeHeading: "உங்கள் மின்னஞ்சலைப் பாருங்கள்",
    codeIntro: "{email} இற்கு KELU கணக்கு இருந்தால், 6 இலக்கக் குறியீடு அனுப்பப்பட்டுள்ளது. அது 15 நிமிடங்களில் காலாவதியாகும்.",
    code: "சரிபார்ப்புக் குறியீடு",
    codePh: "6 இலக்கக் குறியீடு",
    verify: "குறியீட்டைச் சரிபார்",
    verifying: "சரிபார்க்கிறது…",
    resend: "குறியீட்டை மீண்டும் அனுப்பு",
    resendIn: "{s} வினாடிகளில் மீண்டும் அனுப்பலாம்",
    resent: "புதிய குறியீடு அனுப்பப்பட்டது.",
    changeEmail: "வேறு மின்னஞ்சலைப் பயன்படுத்து",
    passwordHeading: "புதிய கடவுச்சொல்லை அமையுங்கள்",
    passwordIntro: "KELU-க்கு முன்பு பயன்படுத்தாத கடவுச்சொல்லைத் தேர்ந்தெடுங்கள்.",
    newPassword: "புதிய கடவுச்சொல்",
    newPasswordPh: "குறைந்தது 8 எழுத்துகள்",
    confirmPassword: "கடவுச்சொல்லை உறுதிப்படுத்துங்கள்",
    confirmPasswordPh: "மீண்டும் உள்ளிடுங்கள்",
    save: "கடவுச்சொல்லைச் சேமி",
    saving: "சேமிக்கிறது…",
    doneTitle: "கடவுச்சொல் மாற்றப்பட்டது",
    doneText: "நீங்கள் உள்நுழைந்துவிட்டீர்கள். மற்ற சாதனங்களிலிருந்து வெளியேற்றப்பட்டுள்ளீர்கள்.",
    doneCta: "முகப்புக்குத் திரும்பு",
    backToLogin: "உள்நுழைவுக்குத் திரும்பு",
    errors: {
      email: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்.",
      code: "மின்னஞ்சலில் உள்ள 6 இலக்கக் குறியீட்டை உள்ளிடுங்கள்.",
      invalidCode: "குறியீடு தவறானது அல்லது காலாவதியானது. மின்னஞ்சலைச் சரிபாருங்கள் அல்லது புதிய குறியீட்டைப் பெறுங்கள்.",
      password: "கடவுச்சொல் குறைந்தது 8 எழுத்துகளாக இருக்க வேண்டும்.",
      passwordTooLong: "கடவுச்சொல் மிக நீளமானது. சிறியதொன்றைப் பயன்படுத்துங்கள்.",
      mismatch: "கடவுச்சொற்கள் பொருந்தவில்லை.",
      expired: "மீட்டமைப்புக்கு அதிக நேரம் ஆகிவிட்டது. மீண்டும் தொடங்குங்கள்.",
      network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
      generic: "ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயலுங்கள்.",
    },
  },
  dashboard: {
    nav: {
      home: "முகப்பு", practice: "பயிற்சி", tutor: "AI ஆசிரியர்", pastPapers: "கடந்தகால வினாத்தாள்கள்", progress: "முன்னேற்றம்",
      saved: "சேமித்த வினாக்கள்", subscription: "சந்தா", settings: "அமைப்புகள்", logout: "வெளியேறு",
      sidebar: "கட்டுப்பாட்டுப் பலகை", openMenu: "பட்டியலைத் திற", search: "தேடு", notifications: "அறிவிப்புகள்", account: "கணக்குப் பட்டியல்",
    },
    greeting: { morning: "காலை வணக்கம், {name}", afternoon: "மதிய வணக்கம், {name}", evening: "மாலை வணக்கம், {name}" },
    medium: { ta: "தமிழ் மொழிமூலம்", en: "ஆங்கில மொழிமூலம்" },
    examYear: "உ/த {n}",
    trialDays: "{n} நாட்கள்",
    trialLabel: "இலவச சோதனைக் காலம்",
    cheer: "இன்றே கற்கத் தொடங்குவோம்! உங்களால் முடியும்!",
    goalEyebrow: "இன்றைய இலக்கு",
    goalTitle: "தினசரி வினாடி வினா · 10 வினாக்கள்",
    goalMeta: "சுமார் 15 நிமிடம் · கடந்தகால வினாத்தாள் பாணி வினாக்கள்",
    startQuiz: "தொடங்கு",
    plan: "உங்கள் கற்றல் திட்டம்",
    needsWork: "கவனம் தேவை",
    continueTitle: "தொடருங்கள்",
    thisWeek: "இந்த வாரம்",
    empty: {
      plan: { title: "இன்னும் கற்றல் திட்டம் இல்லை", text: "உங்கள் முதல் வினாடி வினாவைச் செய்யுங்கள்; உங்களுக்குக் கடினமான தலைப்புகளைக் கொண்டு KELU ஒரு திட்டத்தை உருவாக்கும்." },
      needsWork: { title: "இன்னும் தலைப்புப் புள்ளிகள் இல்லை", text: "சில வினாக்களுக்கு விடையளியுங்கள்; கவனம் தேவையான தலைப்புகள் இங்கே தோன்றும்." },
      continue: { title: "தொடர இன்னும் எதுவும் இல்லை", text: "உங்கள் ஆசிரியர் உரையாடல்களும் சேமித்த வினாக்களும் இங்கே தோன்றும்." },
      week: { title: "இந்த வாரம் செயற்பாடு இல்லை", text: "உங்கள் தினசரி இலக்குகள், விடையளித்த வினாக்கள், சராசரிப் புள்ளி இங்கே பதிவாகும்." },
    },
    home: {
      planWeak: "இதுவரை {pct}% · மேம்படுத்துங்கள்", planNew: "இன்னும் முயலவில்லை · இங்கே தொடங்குங்கள்", practice: "பயிற்சி",
      topicScore: "{pct}% · {n} வினாக்கள்",
      allGood: { title: "தற்போது பலவீனமான தலைப்புகள் இல்லை", text: "நீங்கள் முயன்ற எல்லாத் தலைப்புகளும் 70% அல்லது அதற்கு மேல். தொடருங்கள்!" },
      questions: "வினாக்கள்", avgScore: "சராசரி", streak: "தொடர் நாட்கள்", dayNames: ["தி", "செ", "பு", "வி", "வெ", "ச", "ஞா"],
      quiz: "{topic} வினாடி வினா", mixedQuiz: "கலப்பு வினாடி வினா", result: "{p}/{n} முழுமையாகச் சரி", tutorChat: "ஆசிரியர் உரையாடல்", resume: "தொடர்",
      loadFailed: "உங்கள் முன்னேற்றத்தை ஏற்ற முடியவில்லை.", retry: "மீண்டும் முயல்",
      fullLock: {
        title: "இந்த வினாடி வினா பரீட்சை ஆண்டு மாணவர்களுக்கு மட்டும்",
        text: "10 வினாக்கள் கொண்ட முழுப் பாடத்திட்ட வினாடி வினா, உங்கள் உ/த பரீட்சை நெருங்கும் பரீட்சை ஆண்டில் ({year}) திறக்கப்படும். அதுவரை பயிற்சிப் பக்கத்தில் 5 வினாக்கள் கொண்ட தலைப்பு வினாடி வினாக்களைச் செய்து உங்கள் திறனை வளர்த்துக்கொள்ளுங்கள். அவை எளிதிலிருந்து கடினம் வரை படிப்படியாக உயரும்!",
        textNoYear: "10 வினாக்கள் கொண்ட முழுப் பாடத்திட்ட வினாடி வினா உங்கள் பரீட்சை ஆண்டில் திறக்கப்படும். அதுவரை பயிற்சிப் பக்கத்தில் 5 வினாக்கள் கொண்ட தலைப்பு வினாடி வினாக்களைச் செய்து உங்கள் திறனை வளர்த்துக்கொள்ளுங்கள். அவை எளிதிலிருந்து கடினம் வரை படிப்படியாக உயரும்!",
        go: "பயிற்சிக்குச் செல்", close: "பின்னர்", checking: "சரிபார்க்கிறது...",
      },
    },
    partner: "உ/த வெற்றிக்கான உங்கள் AI கணிதத் துணை",
    askPlaceholder: "இணைந்த கணிதம் பற்றி KELU இடம் எதையும் கேளுங்கள்...",
    ask: "KELU இடம் கேள்",
    voice: "குரலால் கேள்",
    attach: "உங்கள் செய்கையை இணை",
    comingSoon: "விரைவில்",
    comingSoonText: "KELU இன் இந்தப் பகுதி உருவாக்கப்பட்டு வருகிறது. விரைவில் பாருங்கள்!",
    backHome: "கட்டுப்பாட்டுப் பலகைக்குத் திரும்பு",
    loading: "உங்கள் பலகை ஏற்றப்படுகிறது...",
    crashTitle: "ஏதோ தவறு நடந்துவிட்டது",
    crashText: "இந்தப் பக்கத்தில் பிழை ஏற்பட்டது. மீள ஏற்றினால் பொதுவாகச் சரியாகும்.",
    reload: "மீள ஏற்று",
    tutor: {
      newChat: "புதிய உரையாடல்",
      search: "உரையாடல்களைத் தேடு...",
      groups: { today: "இன்று", yesterday: "நேற்று", week: "இந்த வாரம்", older: "முன்பு" },
      noChats: "இன்னும் உரையாடல்கள் இல்லை. உங்கள் முதல் வினாவைக் கேளுங்கள்!",
      noMatches: "உங்கள் தேடலுக்குப் பொருந்தும் உரையாடல் இல்லை.",
      savedQuestion: "சேமித்த வினா",
      messages: "{n} செய்திகள்",
      bannerTitle: "எதையும் கேளுங்கள், படிப்படியாகக் கற்றுக்கொள்ளுங்கள்!",
      bannerText: "விடைகள் அல்ல, குறிப்புகள்.",
      untitled: "புதிய உரையாடல்",
      modeChip: "முதலில் குறிப்புகள் · கடந்தகால வினாத்தாள்களிலிருந்து விடைகள்",
      save: "இந்த உரையாடலைச் சேமி",
      unsave: "சேமிப்பிலிருந்து நீக்கு",
      more: "மேலும் தெரிவுகள்",
      deleteChat: "உரையாடலை நீக்கு",
      deleteTitle: "இந்த உரையாடலை நீக்கவா?",
      deleteText: "“{title}” இந்தச் சாதனத்திலிருந்து நீக்கப்படும். இதை மீட்டெடுக்க முடியாது.",
      cancel: "ரத்துசெய்",
      confirmDelete: "நீக்கு",
      toggleChats: "உரையாடல்களைக் காட்டு",
      welcomeTitle: "வணக்கம்! நான் KELU, உங்கள் கணித ஆசிரியர்.",
      welcomeText: "எந்த வினாவில் சிக்கியுள்ளீர்கள் என்று சொல்லுங்கள். நீங்களே தீர்க்கக் கற்றுக்கொள்ள, ஒவ்வொரு படியாகக் குறிப்புகள் தருவேன்.",
      starters: [
        "x eˣ dx ஐத் தொகையிடுவதை எப்படித் தொடங்குவது?",
        "இரு காவிகளின் புள்ளிப் பெருக்கத்தை விளக்குங்கள்",
        "2019 வினாத்தாள் I பகுதி A வினா 3 இற்கு உதவுங்கள்",
      ],
      hint: "குறிப்பு {n} / {max}",
      you: "நீங்கள்",
      listen: "கேள்",
      stop: "நிறுத்து",
      thinking: "KELU யோசிக்கிறது...",
      nextHint: "அடுத்த குறிப்பைத் தாருங்கள்",
      iThink: "இது – என்று நினைக்கிறேன், ஏனெனில்...",
      iThinkPrefill: "இது  என்று நினைக்கிறேன், ஏனெனில் ",
      similar: "இதைப் போன்ற வினா ஒன்றைக் காட்டுங்கள்",
      nextHintMessage: "தயவுசெய்து அடுத்த குறிப்பைத் தாருங்கள்.",
      similarMessage: "பயிற்சி செய்ய இதைப் போன்ற வினா ஒன்றைக் காட்டுங்கள்.",
      placeholder: "உங்கள் வினா அல்லது செய்தியைத் தட்டச்சு செய்யுங்கள்...",
      attach: "வினா, வரைபு அல்லது உங்கள் செய்கையின் படத்தை இணை",
      attachSoon: "செய்கையை இணைக்கும் வசதி விரைவில்",
      image: {
        remove: "படத்தை நீக்கு", onlyMessage: "இந்தப் படத்தைப் பாருங்கள்.",
        historyNote: "[நான் ஒரு படத்தை இணைத்தேன்]", alt: "இணைத்த படம்", dropHere: "இணைக்கப் படத்தை இங்கே விடுங்கள்",
      },
      voice: "குரலால் கேள்",
      voiceStop: "கேட்பதை நிறுத்து",
      send: "அனுப்பு",
      usage: "இன்று {n}/{max} செய்திகள் பயன்படுத்தப்பட்டன",
      limitReached: "இன்றைய {max} செய்திகளையும் பயன்படுத்திவிட்டீர்கள். நாளை மீண்டும் வாருங்கள்!",
      disclaimer: "KELU தவறு செய்யலாம். முக்கியமான படிகளை உங்கள் ஆசிரியரிடம் சரிபாருங்கள்.",
      truncated: "(பதில் இடையில் நின்றுவிட்டது. தொடரச் சொல்லுங்கள்.)",
      retry: "மீண்டும் முயல்",
      errors: {
        notConfigured: "ஆசிரியர் இன்னும் அமைக்கப்படவில்லை. பின்னர் முயலுங்கள்.",
        failed: "இப்போது பதிலளிக்க முடியவில்லை. மீண்டும் முயலுங்கள்.",
        network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
        badImage: "இந்தக் கோப்பை வாசிக்க முடியவில்லை. JPG, PNG அல்லது WebP படத்தைப் பயன்படுத்துங்கள்.",
        imageTooLarge: "படம் மிகப் பெரியது. சிறிய படம் அல்லது திரைப்பிடிப்பை முயலுங்கள்.",
      },
    },
    pastPapers: {
      title: "கடந்தகால வினாத்தாள்கள்",
      subtitle: "KELU நூலகத்தில் உள்ள இலங்கை உயர்தர இணைந்த கணித வினாத்தாள்களைப் பாருங்கள்.",
      tabs: { papers: "கடந்தகால வினாத்தாள்கள்", topic: "தலைப்பு வாரியாக", schemes: "புள்ளித் திட்டங்கள்" },
      soon: "விரைவில்",
      selectYear: "ஆண்டைத் தெரிவுசெய்க",
      yearTitle: "உயர்தர இணைந்த கணிதம் – {year}",
      kinds: { past_paper: "வினாத்தாள்", marking_scheme: "புள்ளித் திட்டம்" },
      paper: "வினாத்தாள் {n}",
      part: "பகுதி {n}",
      page: "பக்கம் {n}",
      pages: "{n} பக்கங்கள்",
      questions: "{n} வினாக்கள்",
      questionLabel: "வினா {n}",
      sections: "பிரிவுகள்: {n}",
      read: "வாசிக்க",
      wholeDocument: "முழு ஆவணம்",
      schemeOnly: "{year} ஆண்டுக்கான புள்ளித் திட்டம் மட்டுமே தற்போது KELU இல் உள்ளது. வினாத்தாள் இன்னும் சேர்க்கப்படவில்லை.",
      libraryTitle: "நூலகத்தில்",
      statYears: "பரீட்சை ஆண்டுகள்",
      statPapers: "வினாத்தாள்கள்",
      statSchemes: "புள்ளித் திட்டங்கள்",
      statQuestions: "கண்டறியப்பட்ட வினாக்கள்",
      quickTitle: "விரைவுச் செயல்கள்",
      random: "ஏதேனும் ஒரு வினாத்தாள்",
      askTutor: "AI ஆசிரியரிடம் கேளுங்கள்",
      loading: "வினாத்தாள்கள் ஏற்றப்படுகின்றன…",
      retry: "மீண்டும் முயற்சிக்க",
      errorTitle: "வினாத்தாள்களை ஏற்ற முடியவில்லை",
      errorText: "உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
      emptyTitle: "இன்னும் வினாத்தாள்கள் இல்லை",
      emptyText: "கடந்தகால வினாத்தாள்கள் KELU இல் சேர்க்கப்பட்டதும் இங்கே தோன்றும்.",
      back: "அனைத்து வினாத்தாள்களும்",
      sectionsTitle: "பிரிவுகள்",
      transcribed: "இந்த உரை தானாகப் படியெடுக்கப்பட்டது; எனவே கணித வடிவமைப்பு மாறியிருக்கலாம்: உதாரணமாக, x² என்பது x2 எனவும், ¼ என்பது 14 எனவும் தோன்றலாம். சூத்திரங்களைக் கவனமாகச் சரிபார்க்கவும்.",
      nothingHere: "இந்தப் பிரிவில் எதுவும் கிடைக்கவில்லை.",
      notFoundTitle: "வினாத்தாள் கிடைக்கவில்லை",
      notFoundText: "இந்த வினாத்தாள் நூலகத்தில் இல்லை.",
    },
    progress: {
      title: "உங்கள் முன்னேற்றம்",
      subtitle: "உங்கள் இணைந்த கணிதப் பயணத்தின் தெளிவான பார்வை.",
      rangeLabel: "காலப்பகுதி",
      ranges: { "7": "7 நாட்கள்", "30": "30 நாட்கள்", all: "முழுக் காலம்" },
      loading: "உங்கள் முன்னேற்றம் ஏற்றப்படுகிறது…",
      retry: "மீண்டும் முயற்சிக்க",
      errorTitle: "உங்கள் முன்னேற்றத்தை ஏற்ற முடியவில்லை",
      errorText: "உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
      startTitle: "உங்கள் முதல் வினாடி வினாவுடன் அறிக்கை தொடங்கும்",
      startText: "ஒரு பயிற்சித் தொகுதியை முடியுங்கள்; உங்கள் பெறுபேறுகள் இங்கே தோன்றும்.",
      startAction: "பயிற்சியைத் தொடங்குக",
      mastery: "சராசரித் தேர்ச்சி",
      masteryChange: "முந்தைய காலத்துடன் ஒப்பிடுகையில் {n} புள்ளிகள்",
      masteryNoChange: "நீங்கள் முயற்சித்த தலைப்புகளில்",
      topicsCovered: "உள்ளடக்கிய தலைப்புகள்",
      topicsLeft: "{n} இன்னும் முயற்சிக்கவில்லை",
      accuracy: "முதல் முயற்சித் துல்லியம்",
      questionsAnswered: "விடையளித்த வினாக்கள்: {n}",
      streak: "தொடர்ச்சி",
      streakDays: "{n} நாட்கள்",
      streakDay: "{n} நாள்",
      streakBest: "சிறந்த தொடர்ச்சி: {n}",
      weeklyTitle: "வார சராசரிப் புள்ளி",
      weeklyText: "கடந்த {n} வாரங்களில் உங்கள் சராசரிப் புள்ளி.",
      weeklyChange: "கடந்த {n} வாரங்களில் {a}% இலிருந்து {b}% ஆக.",
      weekLabel: "வா{n}",
      thisWeek: "இவ்வாரம்",
      weekDetail: "{pct}% · வினாக்கள்: {n}",
      noPractice: "இந்த வாரம் பயிற்சி இல்லை",
      dailyTitle: "நாளாந்த இலக்கு",
      dailyText: "தொடர்ச்சியை வளர்க்க ஒவ்வொரு நாளும் ஒரு பயிற்சித் தொகுதியை முடியுங்கள்.",
      dailyCount: "{total} இல் {n} நாட்கள்",
      dayStates: { done: "முடிந்தது", missed: "தவறியது", today: "இன்று", before: "இணைவதற்கு முன்" },
      topicsTitle: "தலைப்பு வாரியான தேர்ச்சி",
      topicsText: "குறைந்தது முதலில் · விபரங்களுக்கு ஒரு தலைப்பைத் தெரிவுசெய்க.",
      pure: "தூய கணிதம்",
      applied: "பிரயோக கணிதம்",
      notTried: "முயற்சிக்கவில்லை",
      topicNone: "இந்தக் காலப்பகுதியில் இந்தத் தலைப்பைப் பயிற்சி செய்யவில்லை.",
      topicSteps: "{total} படிகளில் {right} சரி",
      topicLast: "இறுதியாக {when}",
      questionsCount: "வினாக்கள்: {n}",
      appliedNote: "இதை நிரப்பத் தொடங்க, ஒரு பிரயோகப் பாடத்தைப் பயிற்சி செய்யுங்கள்.",
      showAll: "{n} தலைப்புகளையும் காட்டுக",
      showFewer: "குறைவாகக் காட்டுக",
      recentTitle: "அண்மைய வினாடி வினாக்கள்",
      recentText: "உங்கள் அண்மைய முயற்சிகள்.",
      recentEmpty: "நீங்கள் முடித்த வினாடி வினாக்கள் இங்கே பட்டியலிடப்படும்.",
      colType: "வகை",
      colTopic: "தலைப்பு",
      colScore: "புள்ளி",
      colDate: "திகதி",
      kinds: { practice: "பயிற்சி" },
      mixedTopics: "பல்வேறு தலைப்புகள்",
    },
    welcome: {
      hello: "வணக்கம் {name},",
      title: "KELU இற்கு வரவேற்கிறோம்!",
      subtitle: "க.பொ.த உயர்தர இணைந்த கணிதத்துக்கான உங்கள் AI ஆசிரியர். இது எப்படி வேலை செய்கிறது என்பதை இந்தச் சிறிய காணொளியில் பாருங்கள்.",
      videoTitle: "KELU ஐ எப்படிப் பயன்படுத்துவது",
      videoSoon: "காணொளி விரைவில் வரும். நீங்கள் செய்யக்கூடியவை:",
      fullSoon: "இந்தக் காணொளி விரைவில் வரும். பயிற்சிப் பக்கத்திலிருந்து இப்போதே வினாடி வினாவைத் தொடங்கலாம்.",
      steps: [
        { title: "AI ஆசிரியரிடம் கேளுங்கள்", text: "வினாவைத் தட்டச்சு செய்யுங்கள் அல்லது புகைப்படம் அனுப்புங்கள். கடந்தகால வினாத்தாள்களிலிருந்து படிப்படியான குறிப்புகளைப் பெறுவீர்கள்." },
        { title: "பாடவாரியாகப் பயிற்சி", text: "ஒரு தலைப்பைத் தெரிவுசெய்து, எளிதிலிருந்து கடினம் வரை 5 வினாக்களை வழிகாட்டலுடன் தீருங்கள்." },
        { title: "தொடர் நாட்களை உருவாக்குங்கள்", text: "ஒவ்வொரு நாளும் பயிற்சி செய்து, உங்கள் முன்னேற்றத்தையும் பலவீனமான தலைப்புகளையும் பாருங்கள்." },
      ],
      fullTitle: "முழுப் பாடத்திட்ட வினாடி வினா உங்களுக்குத் திறந்துள்ளது",
      fullText: "நீங்கள் பரீட்சை ஆண்டில் இருப்பதால், முழுப் பாடத்திட்டத்தையும் உள்ளடக்கிய 10 வினாக்கள் கொண்ட வினாடி வினாவைச் செய்யலாம்.",
      fullWatch: "எப்படி என்று பாருங்கள்",
      fullVideoTitle: "முழுப் பாடத்திட்ட வினாடி வினா",
      backToMain: "வரவேற்புக் காணொளிக்குத் திரும்பு",
      go: "எனது முகப்புக்குச் செல்",
      skip: "அறிமுகத்தைத் தவிர்",
      close: "மூடு",
      redirect: "{n} வினாடிகளில் உங்கள் முகப்புக்குச் செல்கிறோம்...",
      stay: "இங்கேயே இரு",
    },
    subscription: {
      title: "சந்தா", subtitle: "உங்கள் திட்டம், சோதனை நாட்கள், திட்ட வரலாறு.",
      current: "தற்போதைய திட்டம்", yourPlan: "உங்கள் திட்டம்", noPlan: "இன்னும் திட்டம் இல்லை",
      planNames: { trial: "இலவச சோதனை", free: "இலவசம்", monthly: "மாதாந்தம்", until_exam: "பரீட்சை வரை", class: "வகுப்புத் திட்டம்", annual: "வருடாந்தம்" },
      billing: { free: "எப்போதும்", month: "/ மாதம்", until_exam: "உங்கள் A/L பரீட்சை வரை", student_month: "ஒரு மாணவருக்கு மாதம்" },
      status: { trialing: "சோதனை", active: "செயலில்", expired: "காலாவதி", cancelled: "இரத்து" },
      daysLeft: "{n} நாட்கள் உள்ளன", endsOn: "{date} அன்று முடிகிறது", endedOn: "{date} அன்று முடிந்தது", trialDay: "{total} இல் {used} ஆம் நாள்",
      expiredText: "உங்கள் திட்டம் முடிந்துவிட்டது. முழு அணுகலுக்கு ஒரு திட்டத்தைத் தெரிவுசெய்யுங்கள்.",
      upgradeTitle: "முழு அணுகலுக்கு மேம்படுத்துங்கள்", upgradeText: "வரம்பற்ற பயிற்சி, AI மதிப்பீடு, முழுக் கடந்தகால வினாத்தாள் நூலகம்.",
      bestValue: "சிறந்த மதிப்பு",
      choose: "{plan} தெரிவுசெய்", soon: "இணையவழிக் கட்டணம் விரைவில்",
      soonText: "LKR கட்டண வசதி அமைக்கப்படுகிறது. அதுவரை உங்கள் சோதனைக் காலம் தொடரும்.", comparePlans: "எல்லாத் திட்டங்களையும் ஒப்பிடு",
      history: "திட்ட வரலாறு", colPlan: "திட்டம்", colStatus: "நிலை", colFrom: "தொடக்கம்", colTo: "முடிவு",
      loading: "உங்கள் திட்டத்தை ஏற்றுகிறது...", loadFailed: "உங்கள் திட்டத்தை ஏற்ற முடியவில்லை.", retry: "மீண்டும் முயல்",
    },
    settings: {
      title: "அமைப்புகள்", subtitle: "உங்கள் சுயவிவரம், கடவுச்சொல், கணக்கை நிர்வகியுங்கள்.",
      profile: {
        title: "சுயவிவரம்", text: "KELU உங்களை அறிந்து பயிற்சியை அமைப்பது இதைக் கொண்டே.",
        fullName: "முழுப் பெயர்", email: "மின்னஞ்சல்", emailNote: "மின்னஞ்சலை இங்கே மாற்ற முடியாது.",
        mobile: "கைபேசி இலக்கம்", mobileHelp: "இலங்கைக் கைபேசி இலக்கம் (07X XXX XXXX)",
        medium: "கற்கை மொழிமூலம்", examYear: "உ/த பரீட்சை ஆண்டு",
        parentEmail: "பெற்றோர் / பாதுகாவலர் மின்னஞ்சல்", parentEmailHelp: "விருப்பத்தேர்வு. சேர்க்க விரும்பாவிடின் வெறுமையாக விடுங்கள்.",
        save: "மாற்றங்களைச் சேமி", saved: "சுயவிவரம் சேமிக்கப்பட்டது.",
      },
      password: {
        title: "கடவுச்சொல்", text: "கடவுச்சொல்லை மாற்றினால் உங்கள் மற்றைய சாதனங்களில் வெளியேற்றப்படுவீர்கள்.",
        setTitle: "கடவுச்சொல் அமை", setText: "நீங்கள் Google மூலம் உள்நுழைகிறீர்கள். மின்னஞ்சல் மூலமும் உள்நுழையக் கடவுச்சொல் அமையுங்கள்.",
        current: "தற்போதைய கடவுச்சொல்", new: "புதிய கடவுச்சொல்", confirm: "புதிய கடவுச்சொல்லை உறுதிப்படுத்து",
        save: "கடவுச்சொல்லைப் புதுப்பி", saved: "கடவுச்சொல் புதுப்பிக்கப்பட்டது. மற்றைய சாதனங்களில் வெளியேற்றப்பட்டது.",
      },
      danger: {
        title: "கணக்கை நீக்கு",
        text: "இது உங்கள் கணக்கு, முன்னேற்றம், சேமித்த வினாக்கள், திட்டம் அனைத்தையும் நிரந்தரமாக நீக்கும். மீட்க முடியாது.",
        open: "என் கணக்கை நீக்கு", confirmEmail: "உறுதிப்படுத்த உங்கள் மின்னஞ்சலை ({email}) தட்டச்சு செய்யுங்கள்", password: "உங்கள் கடவுச்சொல்",
        confirm: "நிரந்தரமாக நீக்கு", cancel: "இரத்துசெய்",
      },
      errors: {
        name: "உங்கள் முழுப் பெயரை உள்ளிடுங்கள்.", mobile: "சரியான இலங்கைக் கைபேசி இலக்கத்தை உள்ளிடுங்கள்.", email: "சரியான மின்னஞ்சலை உள்ளிடுங்கள்.",
        passwordShort: "குறைந்தது 8 எழுத்துகள் பயன்படுத்துங்கள்.", passwordTooLong: "கடவுச்சொல் மிக நீளமானது.",
        mismatch: "கடவுச்சொற்கள் பொருந்தவில்லை.", wrongPassword: "கடவுச்சொல் சரியில்லை.", currentRequired: "தற்போதைய கடவுச்சொல்லை உள்ளிடுங்கள்.",
        confirmMismatch: "மின்னஞ்சல் உங்கள் கணக்குடன் பொருந்தவில்லை.", failed: "ஏதோ தவறு நடந்தது. மீண்டும் முயலுங்கள்.",
      },
    },
    practice: {
      title: "பயிற்சி",
      subtitle: "ஒரு பாடத்தைத் தெரிவுசெய்து, AI எழுதிய 5 புதிய வினாக்களைப் படிப்படியாகத் தீருங்கள்.",
      tabs: { all: "பயிற்சி", topic: "தலைப்புவாரி", papers: "கடந்தகால வினாத்தாள்கள்", daily: "தினசரி வினாடி வினா", saved: "சேமித்த வினாக்கள்" },
      topics: "தலைப்புகள்",
      questionsTitle: "பயிற்சி வினாக்கள்",
      quizTitle: "பயிற்சி வினாடி வினா",
      examNote: "ஒவ்வொரு படிக்கும் சரியான செயல்முறையைத் தேர்ந்தெடுங்கள். எல்லா வினாக்களையும் முடித்த பின் விடைகள் காட்டப்படும்.",
      answeredOf: "{total} இல் {n} விடையளிக்கப்பட்டது",
      finishQuiz: "வினாடி வினாவை முடி",
      unansweredWarn: "{n} படிகளுக்கு இன்னும் விடையளிக்கவில்லை. அவை தவறாகக் கணக்கிடப்படும்.",
      resultsTitle: "உங்கள் பெறுபேறுகள்",
      scoreSteps: "{total} படிகளில் {n} சரி",
      scoreQuestions: "{total} வினாக்களில் {n} முழுமையாகச் சரி",
      stepsTally: "{n} / {total} படிகள்",
      yourAnswer: "உங்கள் விடை",
      correctStep: "சரியான படி",
      notAnswered: "விடையளிக்கவில்லை",
      right: "சரி",
      wrong: "தவறு",
      viewResults: "பெறுபேறுகளைப் பார்",
      closeResults: "மூடு",
      close: "வினாடி வினாவை மூடு",
      resumeTitle: "உங்கள் வினாடி வினா காத்திருக்கிறது",
      resumeText: "{total} வினாக்களில் {n} முடிந்தது. வினா {q} இலிருந்து தொடருங்கள், அல்லது ஒரு தலைப்பைத் தேர்ந்தெடுங்கள்.",
      resumeBtn: "வினாடி வினாவைத் தொடர்",
      progress: "{n} / {total} வினாக்கள்",
      steps: "{n} / {total} படிகள்",
      qLabel: "வினா {n}",
      of: "{total} இல் {n}",
      save: "வினாவைச் சேமி",
      unsave: "சேமிப்பிலிருந்து நீக்கு",
      hint: "குறிப்பு",
      stepHint: "படிக் குறிப்பு",
      formula: "சூத்திரம்",
      formulaAsk: "இந்த வினாவுக்கு எந்தச் சூத்திரங்கள் அல்லது முடிவுகள் தேவை? எனக்காகத் தீர்க்க வேண்டாம்.\n\n{q}",
      hintsTitle: "குறிப்புகள்",
      noMoreHints: "எல்லாக் குறிப்புகளும் இவைதான். படிக் குறிப்பைப் பயன்படுத்தித் தீர்த்துப் பாருங்கள்.",
      stepOf: "படி {n} / {total}",
      pickWorking: "இந்தப் படிக்குச் சரியான செய்கையைத் தெரிவுசெய்யுங்கள்:",
      check: "சரிபார்",
      correct: "சரி!",
      tryAgain: "சரியில்லை. காரணத்தை வாசித்து மீண்டும் முயலுங்கள்.",
      showAnswer: "விடையைக் காட்டு",
      answer: "விடை",
      aiLabel: "பயிற்சி வினா (AI உருவாக்கியது)",
      modelledOn: "{src} பாணியில்",
      previous: "முந்தையது",
      next: "அடுத்தது",
      continue: "பயிற்சியைத் தொடர்",
      finish: "முடி",
      doneTitle: "தொகுதி முடிந்தது!",
      doneText: "{total} வினாக்களில் {n} ஐச் செய்து முடித்தீர்கள். தொடர புதிய தொகுதியைத் தொடங்குங்கள்.",
      newSet: "இந்தப் பாடத்தில் புதிய வினாடி வினா",
      startTitle: "பயிற்சி செய்யத் தயாரா?",
      startText: "உண்மையான உ/த வினாத்தாள் I பகுதி A வினாக்களின் பாணியில் KELU 10 புதிய வினாக்களை எழுதும். ஒவ்வொன்றையும் படிப்படியாகச் செய்யுங்கள்.",
      start: "பயிற்சியைத் தொடங்கு",
      generating: "உங்கள் வினாக்கள் எழுதப்படுகின்றன...",
      generatingText: "KELU உங்கள் 5 வினாக்களை எழுதுகிறது. முதலாவது ஓரிரு நிமிடங்களில் தோன்றும். இதற்கிடையில் வேறு தலைப்புகளைப் பார்க்கலாம்: இந்த வினாடி வினா தொடர்ந்து எழுதப்படும்.",
      writingNext: "அடுத்த வினா எழுதப்படுகிறது...",
      readyCount: "{total} இல் {n} தயார்",
      dailyTitle: "தினசரி வினாடி வினா · 10 வினாக்கள்",
      dailyText: "வினாத்தாள் I பகுதி A இன் ஒவ்வொரு தலைப்புக்கும் ஒன்றாக, கடந்தகால வினாத்தாள் பாணியில் புதிய வினாக்கள்.",
      dailyWarn: "இது உங்கள் தற்போதைய தொகுதியை மாற்றும்.",
      savedEmpty: "இன்னும் சேமித்த வினாக்கள் இல்லை",
      savedEmptyText: "எந்த வினாவிலும் உள்ள புத்தகக்குறியைத் தட்டி இங்கே வைத்திருங்கள்.",
      remove: "நீக்கு",
      savedList: {
        count: "{n} சேமிப்பு", search: "சேமித்த வினாக்களைத் தேடு...", allTopics: "எல்லாத் தலைப்புகளும்",
        noMatch: "பொருந்தும் சேமித்த வினாக்கள் இல்லை.", savedOn: "{date} அன்று சேமித்தது", loading: "சேமித்த வினாக்களை ஏற்றுகிறது...",
        loadFailed: "சேமித்த வினாக்களை ஏற்ற முடியவில்லை.", saveFailed: "சேமித்த வினாக்களைப் புதுப்பிக்க முடியவில்லை. மீண்டும் முயலுங்கள்.",
        limit: "சேமிப்பு வரம்பை அடைந்துவிட்டீர்கள். மேலும் சேமிக்கச் சிலவற்றை நீக்குங்கள்.", retry: "மீண்டும் முயல்",
      },
      practiceTopic: "இந்தத் தலைப்பைப் பயிற்சி செய்",
      fullTitle: "முழுப் பாடத்திட்ட வினாடி வினா",
      fullText: "முழுப் பாடத்திட்டத்திலிருந்து {n} வினாக்கள்: தூய கணிதம் {pure}, பிரயோக கணிதம் {applied}. உடனே தொடங்கலாம்.",
      fullLocked: "முழுப் பாடத்திட்டத்தையும் முடித்த பின், உங்கள் பரீட்சை ஆண்டில் இது திறக்கும்.",
      fullSoon: "இந்த வினாடி வினாவுக்கான வினாக்கள் தயாராகின்றன. பின்னர் பாருங்கள்.",
      newFullQuiz: "புதிய முழுப் பாடத்திட்ட வினாடி வினா",
      mine: { title: "உங்கள் தலைப்புகள்", quizzes: "செய்த வினாடி வினாக்கள்: {n}", history: "அண்மைய வினாடி வினாக்கள்", again: "புதிய வினாடி வினா" },
      running: {
        title: "உங்கள் வினாடி வினாக்கள்",
        writing: "வினாக்கள் எழுதப்படுகின்றன… {total} இல் {n} தயார்",
        writingShort: "எழுதப்படுகிறது… {n}/{total}",
        ready: "தொடங்கத் தயார்",
        answering: "{total} இல் {n} விடையளிக்கப்பட்டது",
        done: "முடிந்தது: {pct}%",
        open: "திறக்க",
        continueQuiz: "தொடர்க",
        browse: "வேறு தலைப்புகளைப் பார்க்க",
      },
      instantNote: "ஒவ்வொரு படிக்கும் சரியான செயல்முறையைத் தேர்ந்தெடுத்து, விடையைச் சரிபாருங்கள்.",
      checkAnswer: "விடையைச் சரிபார்",
      levelOf: "நிலை {n} / 5",
      subjectTitle: "ஒரு பாடத்தைத் தெரிவுசெய்க",
      subjectText: "தொடங்க ஒரு தலைப்பைக் கிளிக் செய்யுங்கள். எளிதானதிலிருந்து கடினமானது வரையான 5 வினாக்களும் நீங்கள் மற்றவற்றைப் பார்க்கும்போதே எழுதப்படும்; தயாரானதும் திறவுங்கள்.",
      subjectScore: "உங்கள் பெறுபேறு: {pct}%",
      notTried: "இன்னும் முயற்சிக்கவில்லை",
      loadingTopics: "பாடங்கள் ஏற்றப்படுகின்றன…",
      pure: "தூய கணிதம்",
      applied: "பிரயோக கணிதம்",
      feedback: {
        open: "தவறைத் தெரிவிக்க அல்லது வேறு முறையைப் பகிர",
        kinds: { mistake: "தவறு கண்டேன்", method: "வேறு முறை" },
        mistakeLabel: "என்ன தவறு? சரியானது என்ன என்று நினைக்கிறீர்கள்?",
        methodLabel: "இதை எப்படித் தீர்த்தீர்கள்?",
        photoLabel: "உங்கள் செயல்முறையின் படம் (விரும்பினால்)",
        photoNote: "உங்கள் செய்தியையும் படத்தையும் KELU பணியாளர்கள் பார்ப்பார்கள்; அவற்றைச் சரிபார்க்க AI சேவையும் உதவக்கூடும். மீளாய்வின் பின் படம் நீக்கப்படும். உங்கள் பெயர் அல்லது தனிப்பட்ட விபரங்களைச் சேர்க்க வேண்டாம்.",
        send: "அனுப்புக",
        cancel: "இரத்துச் செய்க",
        thanks: "நன்றி! KELU இதைச் சரிபார்க்கும்.",
        errors: {
          tooLarge: "படம் மிகப் பெரியது. 5 MB இலும் குறைவான படத்தைப் பயன்படுத்தவும்.",
          badImage: "PNG, JPG அல்லது WebP படத்தைப் பயன்படுத்தவும்.",
          tooMany: "இன்று பல அறிக்கைகளை அனுப்பியுள்ளீர்கள். நாளை மீண்டும் முயற்சிக்கவும்.",
          failed: "அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
        },
      },
      errors: {
        tooMany: "ஒரே நேரத்தில் {n} வினாடி வினாக்கள் வரை எழுதப்படலாம். தயாரான ஒன்றைத் திறக்கவும், அல்லது சற்றுப் பொறுக்கவும்.",
        noFullQuiz: "இந்த வினாடி வினாவுக்கான வினாக்கள் இன்னும் தயாராகவில்லை. பின்னர் பாருங்கள்.",
        fullLocked: "முழுப் பாடத்திட்ட வினாடி வினா உங்கள் பரீட்சை ஆண்டில் திறக்கும்.",
        notIndexed: "கடந்தகால வினாத்தாள்கள் இன்னும் ஏற்றப்படவில்லை, எனவே KELU வினாக்களை எழுத முடியாது. பின்னர் முயலுங்கள்.",
        notConfigured: "பயிற்சி இன்னும் அமைக்கப்படவில்லை. பின்னர் முயலுங்கள்.",
        failed: "இப்போது வினாக்களை எழுத முடியவில்லை. மீண்டும் முயலுங்கள்.",
        network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
      },
    },
  },
};

export function getCopy(lang: Lang): Copy {
  return lang === "ta" ? ta : en;
}
