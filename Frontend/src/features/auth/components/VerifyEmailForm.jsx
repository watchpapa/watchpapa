import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import OtpInput from "../../../components/ui/OtpInput.jsx";
import { MailIcon } from "../../../components/icons/index.jsx";
import { validateEmail } from "../../../lib/validate.js";
import { useAuth } from "../hooks/useAuth.js";
import { applyPendingPromoCode } from "../lib/applyPendingPromoCode.js";
import AuthCard from "./shared/AuthCard.jsx";

const RESEND_COOLDOWN = 30;

function VerifyEmailForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [editingEmail, setEditingEmail] = useState(!searchParams.get("email"));
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [info, setInfo] = useState(searchParams.get("sent") ? "We sent a 6-digit code to your inbox." : null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Only count down after a send we know about (just registered, or resend).
  const [cooldown, setCooldown] = useState(searchParams.get("sent") ? RESEND_COOLDOWN : 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onResend = async () => {
    setSubmitError(null);
    setInfo(null);
    const err = validateEmail(email);
    if (err) { setEmailError(err); setEditingEmail(true); return; }
    setIsResending(true);
    const { error } = await resendOtp({ email: email.trim(), type: "signup" });
    setIsResending(false);
    if (error) { setSubmitError(error.message ?? "Failed to send verification code."); return; }
    setInfo(`Code sent to ${email.trim()}.`);
    setEditingEmail(false);
    setCooldown(RESEND_COOLDOWN);
  };

  const onVerify = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    setInfo(null);
    const err = validateEmail(email);
    if (err) { setEmailError(err); setEditingEmail(true); return; }
    if (code.length !== 6) { setCodeError("Enter the full 6-digit code."); return; }
    setCodeError(null);

    setIsVerifying(true);
    const { data, error } = await verifyOtp({ email: email.trim(), token: code, type: "signup" });
    setIsVerifying(false);

    if (error) { setSubmitError(error.message ?? "That code didn't work. Check it and try again."); return; }
    if (data?.session) {
      await applyPendingPromoCode(data.session);
      navigate("/");
      return;
    }
    navigate("/login");
  };

  return (
    <AuthCard
      onSubmit={onVerify}
      title="Check your inbox"
      subtitle="Enter the 6-digit code we emailed you to activate your account."
      footer={
        <>
          Already verified?{" "}
          <Link to="/login" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Sign in</Link>
        </>
      }
    >
      {editingEmail ? (
        <FormField label="Email" htmlFor="verify-email" error={emailError}>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            aria-invalid={Boolean(emailError)}
          />
        </FormField>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/60 px-3.5 py-3">
          <MailIcon size={18} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Sent to</p>
            <p className="truncate text-sm font-semibold text-white">{email}</p>
          </div>
          <Button type="button" variant="ghost" size="xs" onClick={() => setEditingEmail(true)}>Not you?</Button>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-text">Verification code</p>
        <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} disabled={isVerifying} />
        {codeError && <p role="alert" className="mt-2 text-center text-xs font-semibold text-red-300">{codeError}</p>}
      </div>

      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}
      {info && <p className="mt-4 text-center text-sm font-semibold text-emerald-300">{info}</p>}

      <Button type="submit" size="lg" full loading={isVerifying} className="mt-5">
        {isVerifying ? "Verifying…" : "Verify email"}
      </Button>

      <div className="mt-3 text-center">
        <Button type="button" variant="ghost" size="sm" onClick={onResend} disabled={isResending || cooldown > 0} loading={isResending}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : editingEmail ? "Send code" : "Resend code"}
        </Button>
      </div>
    </AuthCard>
  );
}

export default VerifyEmailForm;
