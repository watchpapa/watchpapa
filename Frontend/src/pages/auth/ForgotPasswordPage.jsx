import ForgotPasswordForm from "../../features/auth/components/ForgotPasswordForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <PageHead title="Forgot password" path="/forgot-password" noindex />
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
