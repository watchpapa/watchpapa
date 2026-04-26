import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import OtpInput from "../../../components/ui/OtpInput.jsx";
import { useAuth } from "../hooks/useAuth.js";

function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { resetPasswordForEmail, verifyOtp } = useAuth();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    setSent(false);

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await resetPasswordForEmail({
      email: email.trim(),
      redirectTo,
    });
    setIsSubmitting(false);

    if (error) {
      setSubmitError(error.message ?? "Failed to send reset email.");
      return;
    }

    setSent(true);
  };

  const onVerifyCode = async () => {
    setSubmitError(null);

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    if (otpCode.length !== 6) nextErrors.otpCode = "Enter the full 6-digit code.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsVerifying(true);
    const { error } = await verifyOtp({
      email: email.trim(),
      token: otpCode,
      type: "recovery",
    });
    setIsVerifying(false);

    if (error) {
      setSubmitError(error.message ?? "Invalid reset code.");
      return;
    }

    navigate("/reset-password");
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[520px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(14px,2vw,28px)] pb-[16px] pt-[13px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
    >
      <h1 className="mb-[14px] text-center text-[26px] font-extrabold leading-none text-[#8383e7] sm:text-[34px]">
        Forgot password
      </h1>
      <p className="mb-[18px] text-center text-[14px] font-extrabold text-[#8383e7]/80">
        Enter your email and we&apos;ll send you a reset email with code and link.
      </p>

      <FormField label="email" htmlFor="forgot-email" error={errors.email} labelClassName="text-[18px] sm:text-[22px]">
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="example@watchpapa.tv"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
        />
      </FormField>

      {submitError ? (
        <p className="mt-[12px] text-center text-[13px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}
      {sent ? (
        <p className="mt-[12px] text-center text-[13px] font-semibold text-emerald-300">
          If an account exists for {email}, a reset email has been sent.
        </p>
      ) : null}

      {sent ? (
        <div className="mt-[12px]">
          <p className="mb-[8px] text-center text-[14px] font-extrabold text-[#8383e7]">
            Enter 6-digit reset code
          </p>
          <OtpInput value={otpCode} onChange={setOtpCode} disabled={isVerifying} />
          {errors.otpCode ? (
            <p className="mt-[6px] text-center text-[12px] font-semibold text-pink-300">
              {errors.otpCode}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onVerifyCode}
            disabled={isVerifying}
            className="mt-[10px] inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[16px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify code"}
          </button>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-[18px] inline-flex w-full items-center justify-center rounded-[16px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-3 text-[18px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Send reset link"}
      </button>

      <p className="mt-[18px] text-center text-[14px] font-extrabold text-[#8383e7]">
        Remembered it?{" "}
        <Link to="/login" className="underline transition hover:text-[#a0a0f7]">
          Login
        </Link>
      </p>
    </form>
  );
}

export default ForgotPasswordForm;
