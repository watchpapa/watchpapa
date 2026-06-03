import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { normalizeDateInput, validateMinAge } from "../../../lib/validate.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const initialState = {
  email: "",
  username: "",
  password: "",
  repeatPassword: "",
  dateOfBirth: "",
  acceptedTerms: false,
  emailMarketingOptIn: false,
};


function getPasswordPolicyStatus(pw) {
  return {
    minLength: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function passwordPolicyMissing(pw) {
  const s = getPasswordPolicyStatus(pw);
  const missing = [];
  if (!s.minLength) missing.push("at least 8 characters");
  if (!s.lower) missing.push("a lowercase letter");
  if (!s.upper) missing.push("an uppercase letter");
  if (!s.digit) missing.push("a digit");
  if (!s.symbol) missing.push("a symbol");
  return missing;
}

function joinMissingRequirements(missing) {
  if (missing.length <= 1) return missing[0] ?? "";
  if (missing.length === 2) return `${missing[0]} and ${missing[1]}`;
  return `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;
}

function validate(state) {
  const errors = {};
  const normalizedUsername = state.username.trim();

  if (!state.email.trim()) errors.email = "Email is required.";
  if (!normalizedUsername) {
    errors.username = "Username is required.";
  } else if (normalizedUsername.length < 4) {
    errors.username = "Username must be at least 4 characters.";
  }

  if (!state.password) {
    errors.password = "Password is required.";
  } else {
    const missing = passwordPolicyMissing(state.password);
    if (missing.length > 0) {
      errors.password = `Password must include ${joinMissingRequirements(missing)}.`;
    }
  }

  if (!state.repeatPassword) {
    errors.repeatPassword = "Please repeat your password.";
  } else if (state.repeatPassword !== state.password) {
    errors.repeatPassword = "Passwords do not match.";
  }

  if (!state.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (!validateMinAge(state.dateOfBirth, 16)) {
    errors.dateOfBirth = "You must be at least 16 years old to register.";
  }

  if (!state.acceptedTerms) {
    errors.acceptedTerms = "You must accept the Terms and Conditions to continue.";
  }

  return errors;
}

function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithOAuth } = useAuth();

  const [formState, setFormState] = useState(initialState);
  const [promoCode, setPromoCode] = useState(() => searchParams.get("ref")?.toUpperCase() ?? "");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const passwordPolicy = getPasswordPolicyStatus(formState.password);
  const repeatPasswordMatches =
    formState.repeatPassword.length > 0 &&
    formState.repeatPassword === formState.password;

  const onChangeField = (fieldName) => (event) => {
    const raw = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    const nextValue = fieldName === "dateOfBirth" ? normalizeDateInput(raw) : raw;
    setFormState((current) => ({ ...current, [fieldName]: nextValue }));
    setErrors((current) => {
      if (!current[fieldName] && !(fieldName === "password" && current.repeatPassword)) return current;
      const next = { ...current };
      delete next[fieldName];
      if (fieldName === "password") delete next.repeatPassword;
      return next;
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = validate(formState);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const emailRedirectTo = `${window.location.origin}/verify-email`;
    const { data, error } = await signUp({
      email: formState.email.trim(),
      password: formState.password,
      emailRedirectTo,
      metadata: {
        username: formState.username.trim(),
        date_of_birth: formState.dateOfBirth,
        show_adult_content: false,
        email_marketing_opt_in: formState.emailMarketingOptIn,
      },
    });
    setIsSubmitting(false);

    if (error) {
      const normalized = error.message?.toLowerCase() ?? "";
      if (
        normalized.includes("already registered") ||
        normalized.includes("already exists") ||
        normalized.includes("user already") ||
        normalized.includes("email address is invalid")
      ) {
        setSubmitError("This email is already in use.");
      } else {
        setSubmitError(error.message ?? "Failed to create account.");
      }
      return;
    }

    const finalPromoCode = promoCode.trim().toUpperCase() || null;

    // Confirmations off: session returned immediately — apply code now.
    if (data?.session) {
      if (finalPromoCode) {
        const token = data.session.access_token;
        fetch(`${API_BASE}/api/referral/use/${encodeURIComponent(finalPromoCode)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (!res.ok && res.status === 404) {
              fetch(`${API_BASE}/api/rewards/claim`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ code: finalPromoCode }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
      navigate("/", { replace: true });
      return;
    }

    // Email confirmation required — persist code for VerifyEmailForm to apply after OTP.
    if (finalPromoCode) {
      sessionStorage.setItem("pendingPromoCode", finalPromoCode);
    }

    // With email confirmation, `user` may be null (GoTrue obfuscation); still send user to verify flow
    navigate(
      `/verify-email?email=${encodeURIComponent(formState.email.trim())}`,
      { replace: true },
    );
  };

  const onOAuth = (provider) => async () => {
    setSubmitError(null);
    const { error } = await signInWithOAuth({
      provider,
      redirectTo: `${window.location.origin}/`,
    });
    if (error) setSubmitError(error.message ?? `Failed to sign in with ${provider}.`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[980px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(8,11,46,0.82)] to-[rgba(14,19,66,0.88)] px-[clamp(24px,4vw,56px)] pb-[20px] pt-[16px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] backdrop-blur-[12px]"
    >
      <h1 className="mb-[12px] text-center text-[24px] font-extrabold leading-none text-[#8383e7] sm:text-[30px]">
        Register
      </h1>

      <div className="grid grid-cols-1 gap-x-[clamp(20px,3vw,40px)] gap-y-[18px] md:grid-cols-2">
        <FormField label="email" htmlFor="email" error={errors.email} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@watchpapa.tv"
            value={formState.email}
            onChange={onChangeField("email")}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>

        <FormField label="username" htmlFor="username" error={errors.username} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="username"
            value={formState.username}
            onChange={onChangeField("username")}
            aria-invalid={Boolean(errors.username)}
          />
        </FormField>

        <FormField label="password" htmlFor="password" error={errors.password} labelClassName="text-[18px] sm:text-[22px]">
          <div className="space-y-[4px]">
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="************"
                value={formState.password}
                onChange={onChangeField("password")}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="password-requirements"
                className="pr-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#6f6fdc] transition hover:text-[#a0a0f7]"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <ul
              id="password-requirements"
              className="list-none space-y-[3px] text-[11px] font-semibold leading-snug transition-colors"
              aria-live="polite"
            >
              {[
                { met: passwordPolicy.minLength, label: "At least 8 characters" },
                { met: passwordPolicy.lower, label: "One lowercase letter" },
                { met: passwordPolicy.upper, label: "One uppercase letter" },
                { met: passwordPolicy.digit, label: "One digit" },
                { met: passwordPolicy.symbol, label: "One symbol (!@#$% etc.)" },
              ].map(({ met, label }) => (
                <li
                  key={label}
                  className={met ? "text-emerald-400/95" : "text-[#a0a0f7]/75"}
                >
                  <span aria-hidden>{met ? "✓ " : "○ "}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </FormField>

        <FormField
          label="repeat password"
          htmlFor="repeatPassword"
          error={errors.repeatPassword}
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <div className="space-y-[4px]">
            <div className="relative">
              <Input
                id="repeatPassword"
                name="repeatPassword"
                type={showRepeatPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="************"
                value={formState.repeatPassword}
                onChange={onChangeField("repeatPassword")}
                aria-invalid={Boolean(errors.repeatPassword)}
                aria-describedby="repeat-password-hint"
                className="pr-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword((v) => !v)}
                aria-label={showRepeatPassword ? "Hide password" : "Show password"}
                className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#6f6fdc] transition hover:text-[#a0a0f7]"
              >
                {showRepeatPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <p
              id="repeat-password-hint"
              className={`text-[11px] font-semibold leading-snug transition-colors ${repeatPasswordMatches ? "text-emerald-400/95" : "text-[#a0a0f7]/75"}`}
              aria-live="polite"
            >
              <span aria-hidden>{repeatPasswordMatches ? "✓ " : "○ "}</span>
              Must match the password field exactly.
            </p>
          </div>
        </FormField>

        <FormField
          label="date of birth"
          htmlFor="dateOfBirth"
          error={errors.dateOfBirth}
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={formState.dateOfBirth}
            onChange={onChangeField("dateOfBirth")}
            aria-invalid={Boolean(errors.dateOfBirth)}
          />
        </FormField>

        <FormField label={<>referral or gift code <span className="text-[#a0a0f7]/50">(optional)</span></>} htmlFor="promoCode" labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="promoCode"
            name="promoCode"
            type="text"
            placeholder="ENTER CODE"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          />
        </FormField>
      </div>

      <div className="mt-[14px] flex flex-col gap-[4px]">
        <label className="flex cursor-pointer items-start gap-[10px]">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            checked={formState.acceptedTerms}
            onChange={onChangeField("acceptedTerms")}
            aria-invalid={Boolean(errors.acceptedTerms)}
            className="mt-[3px] h-[16px] w-[16px] shrink-0 cursor-pointer accent-[#8383e7]"
          />
          <span className="text-[13px] font-semibold leading-snug text-[#a0a0f7]">
            I agree to the{" "}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition hover:text-white"
            >
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition hover:text-white"
            >
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.acceptedTerms ? (
          <p className="text-[11px] font-semibold text-pink-300">{errors.acceptedTerms}</p>
        ) : null}
      </div>

      <div className="mt-[14px] flex flex-col gap-[4px]">
        <label className="flex cursor-pointer items-start gap-[10px]">
          <input
            id="emailMarketingOptIn"
            name="emailMarketingOptIn"
            type="checkbox"
            checked={formState.emailMarketingOptIn}
            onChange={onChangeField("emailMarketingOptIn")}
            className="mt-[3px] h-[16px] w-[16px] shrink-0 cursor-pointer accent-[#8383e7]"
          />
          <span className="text-[13px] font-semibold leading-snug text-[#a0a0f7]">
            I'd like to receive occasional product updates and announcements (optional)
          </span>
        </label>
      </div>

      {submitError ? (
        <p className="mt-[10px] text-center text-[12px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-[12px] inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[16px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f6fdc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111320] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <div className="mt-[10px] flex items-center gap-[8px] text-[14px] font-extrabold text-[#8383e7]">
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
        <span>or</span>
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
      </div>

      <div className="mt-[10px] flex flex-col items-center gap-[8px]">
        <button
          type="button"
          onClick={onOAuth("google")}
          className="inline-flex w-full max-w-[360px] items-center justify-center gap-[10px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          onClick={onOAuth("github")}
          className="inline-flex w-full max-w-[360px] items-center justify-center gap-[10px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current" aria-hidden>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          Continue with GitHub
        </button>
      </div>

      <p className="mt-[12px] text-center text-[13px] font-extrabold text-[#8383e7]">
        Already a member?{" "}
        <Link to="/login" className="underline transition hover:text-[#a0a0f7]">
          Login
        </Link>
      </p>
    </form>
  );
}

export default RegisterForm;
