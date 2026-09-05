import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import { ArrowLeftIcon } from "../../../components/icons/index.jsx";
import { validateEmail, validateMinAge, validatePassword, validateUsername } from "../../../lib/validate.js";
import { useAuth } from "../hooks/useAuth.js";
import { applyPromoCode, stashPendingPromoCode } from "../lib/applyPendingPromoCode.js";
import AuthCard from "./shared/AuthCard.jsx";
import OAuthButtons from "./shared/OAuthButtons.jsx";
import PasswordField from "./shared/PasswordField.jsx";
import ProfileDetailsFields from "./shared/ProfileDetailsFields.jsx";
import StepIndicator from "./shared/StepIndicator.jsx";

const STEPS = ["Account", "About you"];

function validateStep1(v) {
  const e = {};
  const emailErr = validateEmail(v.email);
  if (emailErr) e.email = emailErr;
  const pwErr = validatePassword(v.password);
  if (pwErr) e.password = pwErr;
  if (!v.repeatPassword) e.repeatPassword = "Please repeat your password.";
  else if (v.repeatPassword !== v.password) e.repeatPassword = "Passwords do not match.";
  return e;
}

function validateStep2(v) {
  const e = {};
  const uErr = validateUsername(v.username.trim());
  if (uErr) e.username = uErr;
  if (!v.dateOfBirth) e.dateOfBirth = "Date of birth is required.";
  else if (!validateMinAge(v.dateOfBirth, 16)) e.dateOfBirth = "You must be at least 16 years old to register.";
  if (!v.acceptedTerms) e.acceptedTerms = "Please accept the Terms and Privacy Policy to continue.";
  return e;
}

// Two-step sign-up: 1) email + password (or OAuth), 2) username, date of
// birth, referral code, consents. Values persist across steps; the account is
// only created on the final submit.
function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  const [step, setStep] = useState(1);
  const [values, setValues] = useState({
    email: "",
    password: "",
    repeatPassword: "",
    username: "",
    dateOfBirth: "",
    promoCode: searchParams.get("ref")?.toUpperCase() ?? "",
    acceptedTerms: false,
    emailMarketingOptIn: false,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => {
      if (!e[field] && !(field === "password" && e.repeatPassword)) return e;
      const next = { ...e };
      delete next[field];
      if (field === "password") delete next.repeatPassword;
      return next;
    });
  };

  const goNext = (event) => {
    event.preventDefault();
    setSubmitError(null);
    const e = validateStep1(values);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(2);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    const e = validateStep2(values);
    setErrors(e);
    if (Object.keys(e).length) return;

    setIsSubmitting(true);
    const { data, error } = await signUp({
      email: values.email.trim(),
      password: values.password,
      emailRedirectTo: `${window.location.origin}/verify-email`,
      metadata: {
        username: values.username.trim(),
        date_of_birth: values.dateOfBirth,
        show_adult_content: false,
        email_marketing_opt_in: values.emailMarketingOptIn,
      },
    });
    setIsSubmitting(false);

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already") || msg.includes("email address is invalid")) {
        setStep(1);
        setErrors({ email: "This email is already in use. Try signing in instead." });
      } else {
        setSubmitError(error.message ?? "Failed to create account.");
      }
      return;
    }

    const code = values.promoCode.trim().toUpperCase() || null;

    // Confirmations off: session returned immediately — apply the code now.
    if (data?.session) {
      if (code) applyPromoCode(code, data.session.access_token);
      navigate("/", { replace: true });
      return;
    }

    // Email confirmation required — VerifyEmailForm applies the code after the OTP.
    if (code) stashPendingPromoCode(code);
    navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}&sent=1`, { replace: true });
  };

  const footer = (
    <>
      Already have an account?{" "}
      <Link to="/login" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Sign in</Link>
    </>
  );

  if (step === 1) {
    return (
      <AuthCard onSubmit={goNext} width="md" title="Create your account" subtitle="Track releases, rate what you watch, share your taste." footer={footer}>
        <StepIndicator steps={STEPS} current={1} />
        <div className="space-y-4">
          <FormField label="Email" htmlFor="reg-email" error={errors.email} required>
            <Input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              data-autofocus
            />
          </FormField>
          <PasswordField
            id="reg-password"
            label="Password"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
            error={errors.password}
            autoComplete="new-password"
            showPolicy
          />
          <PasswordField
            id="reg-repeat"
            label="Repeat password"
            value={values.repeatPassword}
            onChange={(e) => set("repeatPassword", e.target.value)}
            error={errors.repeatPassword}
            autoComplete="new-password"
            hint={values.repeatPassword && values.repeatPassword === values.password ? "✓ Passwords match" : undefined}
          />
        </div>

        {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}

        <Button type="submit" size="lg" full className="mt-5">Continue</Button>
        <OAuthButtons onError={setSubmitError} />
      </AuthCard>
    );
  }

  return (
    <AuthCard onSubmit={onSubmit} width="md" title="About you" subtitle="Pick a username and tell us your date of birth." footer={footer}>
      <StepIndicator steps={STEPS} current={2} />
      <ProfileDetailsFields values={values} errors={errors} onChange={set} disabled={isSubmitting} idPrefix="reg" />

      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}

      <div className="mt-5 flex gap-2">
        <Button type="button" variant="secondary" size="lg" icon={ArrowLeftIcon} onClick={() => { setStep(1); setSubmitError(null); }} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="submit" size="lg" full loading={isSubmitting} className="flex-1">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </div>
    </AuthCard>
  );
}

export default RegisterForm;
