import LoginForm from "../../features/auth/components/LoginForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function LoginPage() {
  return (
    <AuthLayout>
      <PageHead title="Sign in" path="/login" noindex />
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
