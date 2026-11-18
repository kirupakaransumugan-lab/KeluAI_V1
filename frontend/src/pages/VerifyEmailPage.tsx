import { useLanguage } from "../app/providers";
import { AuthLayout } from "../features/auth/AuthLayout";
import { VerifyEmailForm } from "../features/auth/VerifyEmailForm";

export function VerifyEmailPage() {
  const { t } = useLanguage();
  const v = t.verify;

  return (
    <AuthLayout
      pageClass="login-page forgot-page"
      title={
        <>
          <span>{v.titleLead}</span>
          <span><span className="accent underlined">{v.titleAccent}</span>{v.titleTail}</span>
        </>
      }
      subtitle={v.subtitle}
      headingId="ve-heading"
    >
      <VerifyEmailForm />
    </AuthLayout>
  );
}
