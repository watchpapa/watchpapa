import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import OtpInput from "../../../components/ui/OtpInput.jsx";
import { MailIcon } from "../../../components/icons/index.jsx";
import { validateEmail } from "../../../lib/validate.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthCard from "./shared/AuthCard.jsx";

// Two explicit states: request → "we sent a code" (OTP entry, resend, change
// email). The emailed link also lands on /reset-password directly.
function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { resetPasswordForEmail, verifyOtp } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [codeError, setCodeError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const send = async () => {
    setSubmitError(null);
    const err = validateEmail(email);
    if (err) { setEmailError(err); return false; }
    setIsSubmitting(true);
    const { error } = await resetPasswordForEmail({ email: email.trim(), redirectTo: `${window.location.origin}/reset-password` });
    setIsSubmitting(false);
    if (error) { setSubmitError(error.message ?? "Failed to send the reset email."); return false; }
    return true;
  };

  const onRequest = async (event) => {
    event.preventDefault();
    if (await send()) setSent(true);
  };

  const onVerify = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    if (code.length !== 6) { setCodeError("Enter the full 6-digit code."); return; }
    setCodeError(null);
    setIsVerifying(true);
    const { error } = await verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    setIsVerifying(false);
    if (error) { setSubmitError(error.message ?? "That code didn't work. Check it and try again."); return; }
    navigate("/reset-password");
  };

  const footer = (
    <>
      Remembered it?{" "}
      <Link to="/login" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Sign in</Link>
    </>
  );

  if (!sent) {
    return (
      <AuthCard onSubmit={onRequest} title="Forgot your password?" subtitle="Enter your email and we'll send a reset code and link." footer={footer}>
        <FormField label="Email" htmlFor="forgot-email" error={emailError}>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            aria-invalid={Boolean(emailError)}
            data-autofocus
          />
        </FormField>
        {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}
        <Button type="submit" size="lg" full loading={isSubmitting} className="mt-5">
          {isSubmitting ? "Sending…" : "Send reset code"}
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard onSubmit={onVerify} title="Check your inbox" subtitle="If an account exists for that email, a reset code and link are on their way." footer={footer}>
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/60 px-3.5 py-3">
        <MailIcon size={18} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Sent to</p>
          <p className="truncate text-sm font-semibold text-white">{email.trim()}</p>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={() => { setSent(false); setCode(""); setSubmitError(null); }}>Change</Button>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-text">Reset code</p>
        <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} disabled={isVerifying} />
        {codeError && <p role="alert" className="mt-2 text-center text-xs font-semibold text-red-300">{codeError}</p>}
      </div>

      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}

      <Button type="submit" size="lg" full loading={isVerifying} className="mt-5">
        {isVerifying ? "Verifying…" : "Continue"}
      </Button>
      <div className="mt-3 text-center">
        <Button type="button" variant="ghost" size="sm" onClick={send} loading={isSubmitting} disabled={isSubmitting}>
          Resend code
        </Button>
      </div>
    </AuthCard>
  );
}

export default ForgotPasswordForm;
