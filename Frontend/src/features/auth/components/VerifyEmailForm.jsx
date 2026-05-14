import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import OtpInput from "../../../components/ui/OtpInput.jsx";
import { useAuth } from "../hooks/useAuth.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function VerifyEmailForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [info, setInfo] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const onResend = async () => {
    setSubmitError(null);
    setInfo(null);

    if (!email.trim()) {
      setErrors({ email: "Enter your email first." });
      return;
    }

    setIsResending(true);
    const { error } = await resendOtp({ email: email.trim(), type: "signup" });
    setIsResending(false);

    if (error) {
      setSubmitError(error.message ?? "Failed to send verification code.");
      return;
    }

    setInfo("Verification code sent. Check your email.");
  };

  const onVerify = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    setInfo(null);

    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Email is required.";
    if (code.length !== 6) nextErrors.code = "Enter the full 6-digit code.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsVerifying(true);
    const { data, error } = await verifyOtp({
      email: email.trim(),
      token: code,
      type: "signup",
    });
    setIsVerifying(false);

    if (error) {
      setSubmitError(error.message ?? "Invalid verification code.");
      return;
    }

    if (data?.session) {
      const pendingCode = sessionStorage.getItem("pendingReferralCode");
      if (pendingCode) {
        sessionStorage.removeItem("pendingReferralCode");
        fetch(`${API_BASE}/api/referral/use/${encodeURIComponent(pendingCode)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        }).catch(() => {});
      }
      navigate("/");
      return;
    }

    navigate("/login");
  };

  return (
    <form
      onSubmit={onVerify}
      className="w-full max-w-[1040px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(14px,2.5vw,32px)] pb-[18px] pt-[13px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
    >
      <h1 className="mb-[20px] text-center text-[26px] font-extrabold leading-none text-[#8383e7] sm:text-[34px]">
        Verify email
      </h1>

      <div className="mx-auto w-full max-w-[528px]">
        <FormField label="email" htmlFor="verify-email" error={errors.email} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="verify-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@watchpapa.tv"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>
      </div>

      <div className="mt-[14px] flex justify-center">
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="inline-flex w-full max-w-[405px] items-center justify-center rounded-[24px] border-[0.5px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-3 text-[16px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? "Sending..." : "Send verification code to my email"}
        </button>
      </div>

      <div className="mx-auto mt-[18px] w-full max-w-[528px]">
        <p className="mb-[8px] text-[16px] font-extrabold leading-none text-[#8383e7] sm:text-[18px]">
          enter 6-digit code from email
        </p>
        <OtpInput value={code} onChange={setCode} disabled={isVerifying} />
        {errors.code ? (
          <p className="mt-[8px] text-center text-[13px] font-semibold text-pink-300">
            {errors.code}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p className="mt-[14px] text-center text-[13px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}
      {info ? (
        <p className="mt-[14px] text-center text-[13px] font-semibold text-emerald-300">
          {info}
        </p>
      ) : null}

      <div className="mt-[18px] flex justify-center">
        <button
          type="submit"
          disabled={isVerifying}
          className="inline-flex w-full max-w-[222px] items-center justify-center rounded-[24px] border-[0.5px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-3 text-[17px] font-extrabold text-[#8383e7] sm:text-[20px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifying ? "Verifying..." : "Verify"}
        </button>
      </div>

      <p className="mt-[18px] text-center text-[14px] font-extrabold text-[#8383e7]">
        Already a member?{" "}
        <Link to="/login" className="underline transition hover:text-[#a0a0f7]">
          Login
        </Link>
      </p>
    </form>
  );
}

export default VerifyEmailForm;
