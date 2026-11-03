import { useLanguage } from "../app/providers";
import { AuthLayout } from "../features/auth/AuthLayout";
import { ForgotPasswordForm } from "../features/auth/ForgotPasswordForm";

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const f = t.forgot;

  return (
    <AuthLayout
      pageClass="login-page forgot-page"
      title={
        <>
          <span>{f.titleLead}</span>
          <span><span className="accent underlined">{f.titleAccent}</span>{f.titleTail}</span>
        </>
      }
      subtitle={f.subtitle}
      headingId="fp-heading"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
