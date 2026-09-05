import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import { LockIcon } from "../../../components/icons/index.jsx";
import { supabase } from "../../../lib/supabase.js";
import { validatePassword } from "../../../lib/validate.js";
import { useAuth } from "../hooks/useAuth.js";
import AuthCard from "./shared/AuthCard.jsx";
import PasswordField from "./shared/PasswordField.jsx";

function ResetPasswordForm() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [hasRecoverySession, setHasRecoverySession] = useState(null); // null = checking
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setHasRecoverySession(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession((prev) => prev ?? Boolean(data?.session));
    });
    return () => subscription?.subscription?.unsubscribe?.();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    const next = {};
    const pwErr = validatePassword(password);
    if (pwErr) next.password = pwErr;
    if (!repeatPassword) next.repeatPassword = "Please repeat your new password.";
    else if (repeatPassword !== password) next.repeatPassword = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSubmitting(true);
    const { error } = await updatePassword({ password });
    setIsSubmitting(false);
    if (error) { setSubmitError(error.message ?? "Failed to update the password."); return; }

    setSuccess(true);
    await supabase.auth.signOut({ scope: "local" });
    setTimeout(() => navigate("/login"), 1500);
  };

  if (hasRecoverySession === false) {
    return (
      <AuthCard title="Reset link needed" subtitle="Open this page from the password-reset email, or request a new code.">
        <div className="flex flex-col items-center py-2 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 text-text-dim">
            <LockIcon size={22} />
          </span>
          <Button to="/forgot-password" size="lg" full>Request a new reset code</Button>
          <Link to="/login" className="mt-4 text-sm font-semibold text-text-link underline underline-offset-2 hover:text-white">Back to sign in</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      onSubmit={onSubmit}
      title="Choose a new password"
      subtitle="You'll be signed out of this browser afterwards so you can sign in fresh."
      footer={
        <Link to="/login" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Back to sign in</Link>
      }
    >
      <div className="space-y-4">
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: undefined, repeatPassword: undefined })); }}
          error={errors.password}
          autoComplete="new-password"
          showPolicy
          disabled={hasRecoverySession === null}
        />
        <PasswordField
          id="repeat-new-password"
          label="Repeat new password"
          value={repeatPassword}
          onChange={(e) => { setRepeatPassword(e.target.value); setErrors((x) => ({ ...x, repeatPassword: undefined })); }}
          error={errors.repeatPassword}
          autoComplete="new-password"
          disabled={hasRecoverySession === null}
          hint={repeatPassword && repeatPassword === password ? "✓ Passwords match" : undefined}
        />
      </div>

      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}
      {success && <p className="mt-4 text-center text-sm font-semibold text-emerald-300">Password updated. Taking you to sign in…</p>}

      <Button type="submit" size="lg" full loading={isSubmitting} disabled={hasRecoverySession !== true || success} className="mt-5">
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </AuthCard>
  );
}

export default ResetPasswordForm;
