import { useLanguage } from "../app/providers";
import { AuthLayout } from "../features/auth/AuthLayout";
import { LoginForm } from "../features/auth/LoginForm";

export function LoginPage() {
  const { t } = useLanguage();
  const l = t.login;

  return (
    <AuthLayout
      pageClass="login-page"
      title={
        <>
          <span>{l.titleLead}</span>
          <span>{l.titleTo && <>{l.titleTo} </>}<span className="accent underlined">{l.titleAccent}</span>{l.titleTail}</span>
        </>
      }
      subtitle={l.subtitle}
      headingId="li-heading"
    >
      <LoginForm />
    </AuthLayout>
  );
}
