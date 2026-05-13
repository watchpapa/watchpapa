import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import { supabase } from "../../../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";

function ResetPasswordForm() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setHasRecoverySession(true);
    });

    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = {};
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (repeatPassword !== password) {
      nextErrors.repeatPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const { error } = await updatePassword({ password });
    setIsSubmitting(false);

    if (error) {
      setSubmitError(error.message ?? "Failed to update password.");
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut({ scope: "local" });
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[520px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(14px,2vw,28px)] pb-[16px] pt-[13px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
    >
      <h1 className="mb-[14px] text-center text-[26px] font-extrabold leading-none text-[#8383e7] sm:text-[34px]">
        Reset password
      </h1>

      {!hasRecoverySession ? (
        <p className="mb-[12px] text-center text-[13px] font-semibold text-pink-300">
          Open this page from the password reset email link to continue.
        </p>
      ) : null}

      <div className="space-y-[16px]">
        <FormField label="new password" htmlFor="new-password" error={errors.password} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="************"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>

        <FormField
          label="repeat password"
          htmlFor="repeat-new-password"
          error={errors.repeatPassword}
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <Input
            id="repeat-new-password"
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            placeholder="************"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            aria-invalid={Boolean(errors.repeatPassword)}
          />
        </FormField>
      </div>

      {submitError ? (
        <p className="mt-[12px] text-center text-[13px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}
      {success ? (
        <p className="mt-[12px] text-center text-[13px] font-semibold text-emerald-300">
          Password updated. Redirecting to login...
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !hasRecoverySession}
        className="mt-[18px] inline-flex w-full items-center justify-center rounded-[16px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-3 text-[18px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Updating..." : "Update password"}
      </button>

      <p className="mt-[18px] text-center text-[14px] font-extrabold text-[#8383e7]">
        Back to{" "}
        <Link to="/login" className="underline transition hover:text-[#a0a0f7]">
          Login
        </Link>
      </p>
    </form>
  );
}

export default ResetPasswordForm;
