import ResetPasswordForm from "../../features/auth/components/ResetPasswordForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function ResetPasswordPage() {
  return (
    <AuthLayout>
      <PageHead title="Reset password" path="/reset-password" noindex />
      <ResetPasswordForm />
    </AuthLayout>
  );
}

export default ResetPasswordPage;
