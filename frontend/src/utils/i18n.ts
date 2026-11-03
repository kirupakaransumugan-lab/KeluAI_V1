export type Lang = "en" | "ta";

export interface Copy {
  nav: {
    home: string; howItWorks: string; features: string; pricing: string; faq: string; login: string; trial: string; signup: string;
    // Screen-reader labels
    primaryNav: string; mobileNav: string; language: string; menu: string;
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
  errors: { email: string; password: string; invalid: string; network: string; generic: string; google: string };
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
  plans: { trial: PlanCopy; monthly: PlanCopy; annual: PlanCopy };
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
      trial: {
        name: "Free Trial",
        tagline: "Explore KELU with limited access.",
        period: "/ 14 days",
        perks: [
          "20-question diagnostic test",
          "Limited practice questions",
          "Basic hints (step-by-step)",
          "Access to selected past paper questions",
          "Track your progress",
        ],
        cta: "Start 14-day free trial",
      },
      monthly: {
        name: "Monthly",
        tagline: "Full access, one month at a time.",
        period: "/ month",
        perks: [
          "Everything in Free Trial",
          "Unlimited practice questions",
          "AI marking for your working",
          "AI tutor with voice (Tamil / English)",
          "Full past paper library",
          "Save questions and create your own list",
          "Track mastery and daily streaks",
        ],
        cta: "Get Monthly Plan",
      },
      annual: {
        name: "Annual",
        tagline: "Full access for a whole year.",
        period: "/ year",
        perks: [
          "Everything in Monthly Plan",
          "Best value – save more",
          "Full access for 12 months",
          "Unlimited practice and AI marking",
          "AI tutor with voice (Tamil / English)",
          "Complete past paper library",
          "Save questions and create your own list",
          "Track mastery and daily streaks",
          "Early access to new features",
        ],
        cta: "Get Annual Plan",
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
    successCta: "Back to home",
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
    socialSoon: "Google and Microsoft sign-in are coming soon. Please log in with your email for now.",
    microsoftSoon: "Microsoft sign-in is coming soon. Please use Google or your email for now.",
    noAccount: "Don’t have an account?",
    signUp: "Sign up for free",
    errors: {
      email: "Please enter a valid email address.",
      password: "Please enter your password.",
      invalid: "That email and password don’t match. Please try again.",
      network: "We couldn't reach KELU. Check your connection and try again.",
      generic: "Something went wrong. Please try again.",
      google: "Google sign-in didn't work. Please try again.",
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
    successCta: "Back to home",
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
      trial: {
        name: "இலவச சோதனை",
        tagline: "வரையறுக்கப்பட்ட அணுகலுடன் KELU ஐ அறிந்துகொள்ளுங்கள்.",
        period: "/ 14 நாட்கள்",
        perks: [
          "20 வினாக்கள் கொண்ட கண்டறிதல் சோதனை",
          "வரையறுக்கப்பட்ட பயிற்சி வினாக்கள்",
          "அடிப்படைக் குறிப்புகள் (படிப்படியாக)",
          "தெரிவுசெய்யப்பட்ட கடந்தகால வினாக்கள்",
          "முன்னேற்றக் கண்காணிப்பு",
        ],
        cta: "14 நாள் இலவச சோதனையைத் தொடங்கு",
      },
      monthly: {
        name: "மாதாந்தம்",
        tagline: "முழு அணுகல், ஒவ்வொரு மாதமாக.",
        period: "/ மாதம்",
        perks: [
          "இலவச சோதனையில் உள்ள அனைத்தும்",
          "வரம்பற்ற பயிற்சி வினாக்கள்",
          "உங்கள் செய்கைக்கு AI மதிப்பீடு",
          "குரல் வசதியுடன் AI ஆசிரியர் (தமிழ் / ஆங்கிலம்)",
          "முழுமையான கடந்தகால வினாத்தாள் தொகுப்பு",
          "வினாக்களைச் சேமித்து உங்கள் சொந்தப் பட்டியலை உருவாக்குங்கள்",
          "தேர்ச்சியும் தினசரித் தொடர் நாட்களும்",
        ],
        cta: "மாதாந்தத் திட்டத்தைப் பெறுங்கள்",
      },
      annual: {
        name: "வருடாந்தம்",
        tagline: "ஒரு முழு வருடத்துக்கான முழு அணுகல்.",
        period: "/ வருடம்",
        perks: [
          "மாதாந்தத் திட்டத்தில் உள்ள அனைத்தும்",
          "சிறந்த பெறுமதி – அதிகம் சேமியுங்கள்",
          "12 மாதங்களுக்கு முழு அணுகல்",
          "வரம்பற்ற பயிற்சியும் AI மதிப்பீடும்",
          "குரல் வசதியுடன் AI ஆசிரியர் (தமிழ் / ஆங்கிலம்)",
          "முழுமையான கடந்தகால வினாத்தாள் தொகுப்பு",
          "வினாக்களைச் சேமித்து உங்கள் சொந்தப் பட்டியலை உருவாக்குங்கள்",
          "தேர்ச்சியும் தினசரித் தொடர் நாட்களும்",
          "புதிய வசதிகளுக்கு முன்கூட்டிய அணுகல்",
        ],
        cta: "வருடாந்தத் திட்டத்தைப் பெறுங்கள்",
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
    successCta: "முகப்புக்குத் திரும்பு",
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
    socialSoon: "Google, Microsoft மூலம் உள்நுழைவு விரைவில் வரும். இப்போதைக்கு மின்னஞ்சல் மூலம் உள்நுழையுங்கள்.",
    microsoftSoon: "Microsoft மூலம் உள்நுழைவு விரைவில் வரும். இப்போதைக்கு Google அல்லது மின்னஞ்சலைப் பயன்படுத்துங்கள்.",
    noAccount: "கணக்கு இல்லையா?",
    signUp: "இலவசமாகப் பதிவு செய்யுங்கள்",
    errors: {
      email: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடுங்கள்.",
      password: "உங்கள் கடவுச்சொல்லை உள்ளிடுங்கள்.",
      invalid: "மின்னஞ்சலும் கடவுச்சொல்லும் பொருந்தவில்லை. மீண்டும் முயலுங்கள்.",
      network: "KELU உடன் இணைய முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.",
      generic: "ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயலுங்கள்.",
      google: "Google மூலம் உள்நுழைய முடியவில்லை. மீண்டும் முயலுங்கள்.",
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
    successCta: "முகப்புக்குத் திரும்பு",
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
};

export function getCopy(lang: Lang): Copy {
  return lang === "ta" ? ta : en;
}
