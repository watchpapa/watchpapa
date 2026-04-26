import LoginForm from "../../features/auth/components/LoginForm.jsx";
import AuthLayout from "../../layouts/AuthLayout.jsx";

function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}

export default LoginPage;
