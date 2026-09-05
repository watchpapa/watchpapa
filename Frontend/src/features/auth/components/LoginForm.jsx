import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import { validateEmail } from "../../../lib/validate.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthCard from "./shared/AuthCard.jsx";
import OAuthButtons from "./shared/OAuthButtons.jsx";
import PasswordField from "./shared/PasswordField.jsx";

function LoginForm() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearError = (field) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    const next = {};
    const emailErr = validateEmail(email);
    if (emailErr) next.email = emailErr;
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSubmitting(true);
    const { data, error } = await signIn({ email: email.trim(), password });
    setIsSubmitting(false);

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("email not confirmed")) {
        navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setSubmitError(message.includes("invalid login") ? "Wrong email or password." : error.message ?? "Failed to sign in.");
      return;
    }
    if (data?.session) navigate("/");
  };

  return (
    <AuthCard
      onSubmit={onSubmit}
      title="Welcome back"
      subtitle="Sign in to keep tracking what you watch."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Create an account</Link>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Email" htmlFor="login-email" error={errors.email}>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            aria-invalid={Boolean(errors.email)}
            data-autofocus
          />
        </FormField>
        <PasswordField
          id="login-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-text-link underline-offset-2 hover:text-white hover:underline">Forgot password?</Link>
        </div>
      </div>

      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}

      <Button type="submit" size="lg" full loading={isSubmitting} className="mt-5">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <OAuthButtons disabled={isSubmitting} onError={setSubmitError} />
    </AuthCard>
  );
}

export default LoginForm;
