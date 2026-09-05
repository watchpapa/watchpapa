import RegisterForm from "../../features/auth/components/RegisterForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function RegisterPage() {
  return (
    <AuthLayout>
      <PageHead title="Create an account" path="/register" noindex />
      <RegisterForm />
    </AuthLayout>
  );
}

export default RegisterPage;
