import VerifyEmailForm from "../../features/auth/components/VerifyEmailForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function VerifyEmailPage() {
  return (
    <AuthLayout>
      <PageHead title="Verify your email" path="/verify-email" noindex />
      <VerifyEmailForm />
    </AuthLayout>
  );
}

export default VerifyEmailPage;
