import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import { supabase } from "../../../lib/supabase.js";

function normalizeUsername(value) {
  return value.trim();
}

function validateUsername(value) {
  if (!value) return "Username is required.";
  if (value.length < 4) return "Username must be at least 4 characters.";
  if (value.length > 50) return "Username must be less than 50 characters.";
  return null;
}

function CompleteUsernameForm({ userId, initialUsername = "", onCompleted }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState(initialUsername);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError = validateUsername(normalizedUsername);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    if (usernameError) {
      setSubmitError(usernameError);
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const { error: profileError } = await supabase.from("profile").upsert(
      {
        id: userId,
        username: normalizedUsername,
        date_of_birth: "1900-01-01",
        is_adult: true,
        setting_display_adult_content: false,
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
        error={submitError}
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
          aria-invalid={Boolean(submitError)}
          disabled={isSubmitting}
        />
      </FormField>

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
