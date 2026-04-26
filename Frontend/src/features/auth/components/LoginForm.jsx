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
      className="w-full max-w-[480px] rounded-[16px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(12px,1.8vw,22px)] pb-[12px] pt-[11px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
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
          className="inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthProvider === "google" ? "Opening Google..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={onOAuth("github")}
          disabled={isSubmitting || Boolean(oauthProvider)}
          className="inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
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
