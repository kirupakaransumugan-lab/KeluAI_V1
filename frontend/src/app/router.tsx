import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { HowItWorksPage } from "../pages/HowItWorksPage";
import { FeaturesPage } from "../pages/FeaturesPage";
import { PricingPage } from "../pages/PricingPage";
import { SignupPage } from "../pages/SignupPage";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { ComingSoon, DashboardHome } from "../features/dashboard/DashboardHome";
import { SettingsPage } from "../features/account/SettingsPage";
import { SubscriptionPage } from "../features/account/SubscriptionPage";
import { TutorPage } from "../features/ai-tutor/TutorPage";
import { PracticePage } from "../features/practice/PracticePage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { PastPapersPage } from "../features/past-papers/PastPapersPage";
import { PaperReader } from "../features/past-papers/PaperReader";
import { AdminLayout } from "../layouts/AdminLayout";
import { AdminComingSoon, AdminOverview } from "../features/admin/AdminOverview";
import { AdminFeedback } from "../features/admin/AdminFeedback";
import { AdminQuizBank } from "../features/admin/AdminQuizBank";
import { AdminPayments } from "../features/admin/AdminPayments";
import { AdminStudentDetail, AdminStudents } from "../features/admin/AdminStudents";

export function AppRouter() {
  return (
    // Opt in to React Router v7 behaviour now (silences the future-flag console warnings).
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Signed-in app: the layout sends anyone not logged in to /login. */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="saved" element={<Navigate to="/dashboard/practice?tab=saved" replace />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="past-papers" element={<PastPapersPage />} />
          <Route path="past-papers/:uploadId" element={<PaperReader />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<ComingSoon />} />
        </Route>
        {/* Admin area: the layout sends students to /dashboard; the API checks the role too. */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="students/:id" element={<AdminStudentDetail />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="quiz-bank" element={<AdminQuizBank />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="*" element={<AdminComingSoon />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
