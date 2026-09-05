import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import ErrorNote from "../../../components/ui/ErrorNote.jsx";
import { supabase } from "../../../lib/supabase.js";
import { isAdult, validateMinAge, validateUsername } from "../../../lib/validate.js";
import { applyPendingPromoCode } from "../lib/applyPendingPromoCode.js";
import AuthCard from "./shared/AuthCard.jsx";
import ProfileDetailsFields from "./shared/ProfileDetailsFields.jsx";

// OAuth sign-ups (Google/GitHub) arrive without a username or date of birth —
// this is the register wizard's "About you" step, run after the fact.
function CompleteUsernameForm({ userId, initialUsername = "", onCompleted }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: initialUsername,
    dateOfBirth: "",
    showAdultContent: false,
    acceptedTerms: false,
    emailMarketingOptIn: false,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field, value) => {
    setValues((v) => {
      const next = { ...v, [field]: value };
      if (field === "dateOfBirth" && !isAdult(value)) next.showAdultContent = false;
      return next;
    });
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    const username = values.username.trim();
    const next = {};
    const uErr = validateUsername(username);
    if (uErr) next.username = uErr;
    if (!values.dateOfBirth) next.dateOfBirth = "Date of birth is required.";
    else if (!validateMinAge(values.dateOfBirth, 16)) next.dateOfBirth = "You must be at least 16 years old.";
    if (!values.acceptedTerms) next.acceptedTerms = "Please accept the Terms and Privacy Policy to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const adult = isAdult(values.dateOfBirth);
    setIsSubmitting(true);
    const { error: profileError } = await supabase.from("profile").upsert(
      {
        id: userId,
        username,
        date_of_birth: values.dateOfBirth,
        is_adult: adult,
        setting_display_adult_content: adult ? values.showAdultContent : false,
        email_marketing_opt_in: values.emailMarketingOptIn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) {
      setIsSubmitting(false);
      const msg = profileError.message?.toLowerCase() ?? "";
      if (msg.includes("duplicate key value")) setErrors({ username: "This username is already taken." });
      else setSubmitError(profileError.message ?? "Failed to save your profile.");
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ data: { username } });
    setIsSubmitting(false);
    if (authError) {
      setSubmitError(authError.message ?? "Profile saved, but the account metadata update failed.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    await applyPendingPromoCode(session);

    onCompleted?.(username);
    navigate("/", { replace: true });
  };

  return (
    <AuthCard onSubmit={onSubmit} width="md" title="Almost there" subtitle="Pick a username and tell us your date of birth to finish setting up.">
      <ProfileDetailsFields
        values={values}
        errors={errors}
        onChange={set}
        disabled={isSubmitting}
        showReferral={false}
        showAdultSwitch
        idPrefix="oauth"
      />
      {submitError && <ErrorNote inline className="mt-4">{submitError}</ErrorNote>}
      <Button type="submit" size="lg" full loading={isSubmitting} className="mt-5">
        {isSubmitting ? "Saving…" : "Finish setup"}
      </Button>
    </AuthCard>
  );
}

export default CompleteUsernameForm;
