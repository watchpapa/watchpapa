import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import Toggle from "../../../components/ui/Toggle.jsx";
import { supabase } from "../../../lib/supabase.js";
import { validateUsername, normalizeDateInput } from "../../../lib/validate.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function normalizeUsername(value) {
  return value.trim();
}

function isAdult(dateString) {
  if (!dateString) return false;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 18;
}

function CompleteUsernameForm({ userId, initialUsername = "", onCompleted }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState(initialUsername);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [showAdultContent, setShowAdultContent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError = validateUsername(normalizedUsername);
  const adult = isAdult(dateOfBirth);

  const onChangeDateOfBirth = (event) => {
    const next = normalizeDateInput(event.target.value);
    setDateOfBirth(next);
    if (!isAdult(next)) setShowAdultContent(false);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    if (usernameError) {
      setSubmitError(usernameError);
      return;
    }

    if (!dateOfBirth) {
      setSubmitError("Date of birth is required.");
      return;
    }

    if (!acceptedTerms) {
      setSubmitError("You must accept the Terms and Conditions to continue.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const { error: profileError } = await supabase.from("profile").upsert(
      {
        id: userId,
        username: normalizedUsername,
        date_of_birth: dateOfBirth,
        is_adult: adult,
        setting_display_adult_content: adult ? showAdultContent : false,
        email_marketing_opt_in: emailMarketingOptIn,
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      setIsSubmitting(false);
      const normalizedMessage = profileError.message?.toLowerCase() ?? "";
      if (normalizedMessage.includes("duplicate key value")) {
        setSubmitError("This username is already in use.");
      } else {
        setSubmitError(profileError.message ?? "Failed to save username.");
      }
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        username: normalizedUsername,
      },
    });
    setIsSubmitting(false);

    if (authError) {
      setSubmitError(authError.message ?? "Username saved in profile, but auth metadata update failed.");
      return;
    }

    // Apply pending referral or gift code from registration.
    const pendingCode = sessionStorage.getItem("pendingPromoCode");
    if (pendingCode) {
      sessionStorage.removeItem("pendingPromoCode");
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      if (token) {
        const res = await fetch(`${API_BASE}/api/referral/use/${encodeURIComponent(pendingCode)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (res && !res.ok && res.status === 404) {
          fetch(`${API_BASE}/api/rewards/claim`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ code: pendingCode }),
          }).catch(() => {});
        }
      }
    }

    onCompleted?.(normalizedUsername);
    navigate("/", { replace: true });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[560px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(12px,2.2vw,26px)] pb-[16px] pt-[12px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
    >
      <h1 className="mb-[10px] text-center text-[24px] font-extrabold leading-none text-[#8383e7] sm:text-[30px]">
        Choose a username
      </h1>
      <p className="mb-[12px] text-center text-sm font-semibold text-[#a9a9f2]">
        Username is required to finish your account setup.
      </p>

      <FormField
        label="username"
        htmlFor="oauth-username"
        labelClassName="text-[18px] sm:text-[22px]"
      >
        <Input
          id="oauth-username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          aria-invalid={Boolean(usernameError && submitError)}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField
        label="date of birth"
        htmlFor="oauth-dob"
        labelClassName="text-[18px] sm:text-[22px]"
      >
        <Input
          id="oauth-dob"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={onChangeDateOfBirth}
          disabled={isSubmitting}
        />
      </FormField>

      {adult ? (
        <FormField
          label="show adult content"
          htmlFor="oauth-adult"
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <Toggle value={showAdultContent} onChange={setShowAdultContent} />
        </FormField>
      ) : null}

      <div className="mt-[14px] flex flex-col gap-[4px]">
        <label className="flex cursor-pointer items-start gap-[10px]">
          <input
            id="oauth-acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-[3px] h-[16px] w-[16px] shrink-0 cursor-pointer accent-[#8383e7]"
            disabled={isSubmitting}
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
      </div>

      <div className="mt-[8px] flex flex-col gap-[4px]">
        <label className="flex cursor-pointer items-start gap-[10px]">
          <input
            id="oauth-emailMarketingOptIn"
            name="emailMarketingOptIn"
            type="checkbox"
            checked={emailMarketingOptIn}
            onChange={(e) => setEmailMarketingOptIn(e.target.checked)}
            className="mt-[3px] h-[16px] w-[16px] shrink-0 cursor-pointer accent-[#8383e7]"
            disabled={isSubmitting}
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
        {isSubmitting ? "Saving..." : "Save username"}
      </button>
    </form>
  );
}

export default CompleteUsernameForm;
