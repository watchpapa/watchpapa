import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import { useAuth } from "../hooks/useAuth.js";

function LoginForm() {
  const navigate = useNavigate();
  const { signIn, signInWithOAuth } = useAuth();

  const [formState, setFormState] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState(null);

  const onChangeField = (fieldName) => (event) => {
    setFormState((currentState) => ({
      ...currentState,
      [fieldName]: event.target.value,
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formState.email.trim()) {
      nextErrors.email = "Email is required.";
    }

    if (!formState.password.trim()) {
      nextErrors.password = "Password is required.";
    }

    return nextErrors;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await signIn({
      email: formState.email.trim(),
      password: formState.password,
    });
    setIsSubmitting(false);

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("email not confirmed")) {
        navigate(
          `/verify-email?email=${encodeURIComponent(formState.email.trim())}`,
        );
        return;
      }
      setSubmitError(error.message ?? "Failed to sign in.");
      return;
    }

    if (data?.session) {
      navigate("/");
    }
  };

  const onOAuth = (provider) => async () => {
    setSubmitError(null);
    setOauthProvider(provider);
    const { error } = await signInWithOAuth({
      provider,
      redirectTo: `${window.location.origin}/`,
    });
    setOauthProvider(null);

    if (error) {
      setSubmitError(error.message ?? `Failed to sign in with ${provider}.`);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[480px] rounded-[16px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(8,11,46,0.82)] to-[rgba(14,19,66,0.88)] px-[clamp(12px,1.8vw,22px)] pb-[12px] pt-[11px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] backdrop-blur-[12px]"
    >
      <h1 className="mb-[14px] text-center text-[24px] font-extrabold leading-none text-[#8383e7] sm:text-[30px]">
        Login
      </h1>

      <div className="space-y-[12px]">
        <FormField label="email" htmlFor="email" error={errors.email} labelClassName="text-[18px]">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@watchpapa.tv"
            value={formState.email}
            onChange={onChangeField("email")}
            aria-invalid={Boolean(errors.email)}
            className="h-[40px] rounded-[14px] text-[18px]"
          />
        </FormField>

        <FormField
          label="password"
          htmlFor="password"
          error={errors.password}
          labelClassName="text-[18px]"
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="************"
            value={formState.password}
            onChange={onChangeField("password")}
            aria-invalid={Boolean(errors.password)}
            className="h-[40px] rounded-[14px] text-[18px]"
          />
        </FormField>
      </div>

      <div className="mt-[4px] text-right">
        <Link
          to="/forgot-password"
          className="text-[11px] font-extrabold leading-none text-[#8383e7] underline transition hover:text-[#a0a0f7]"
        >
          Forgot password?
        </Link>
      </div>

      {submitError ? (
        <p className="mt-[10px] text-center text-[12px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || Boolean(oauthProvider)}
        className="mt-[12px] inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[16px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f6fdc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111320] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <div className="mt-[12px] flex items-center gap-[8px] text-[13px] font-extrabold text-[#8383e7]">
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
        <span>or</span>
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
      </div>

      <div className="mt-[10px] flex flex-col items-center gap-[8px]">
        <button
          type="button"
          onClick={onOAuth("google")}
          disabled={isSubmitting || Boolean(oauthProvider)}
          className="inline-flex w-full items-center justify-center gap-[8px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {oauthProvider === "google" ? "Opening Google..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={onOAuth("github")}
          disabled={isSubmitting || Boolean(oauthProvider)}
          className="inline-flex w-full items-center justify-center gap-[8px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current" aria-hidden>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          {oauthProvider === "github" ? "Opening GitHub..." : "Continue with GitHub"}
        </button>
      </div>

      <p className="mt-[14px] text-center text-[13px] font-extrabold text-[#8383e7]">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="underline transition hover:text-[#a0a0f7]">
          Register
        </Link>
      </p>
    </form>
  );
}

export default LoginForm;
