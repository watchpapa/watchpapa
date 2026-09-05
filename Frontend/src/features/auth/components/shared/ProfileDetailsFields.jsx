import { Link } from "react-router-dom";
import FormField from "../../../../components/ui/FormField.jsx";
import Input from "../../../../components/ui/Input.jsx";
import Switch from "../../../../components/ui/Switch.jsx";
import { isAdult, maxDateOfBirth, normalizeDateInput } from "../../../../lib/validate.js";

const MIN_AGE = 16;

// The "About you" step: username, date of birth, (optional) referral code,
// terms + marketing consent, and — once the DOB says 18+ — the adult-content
// switch. Used by the register wizard (step 2) and the OAuth completion page.
//
// values: { username, dateOfBirth, promoCode?, acceptedTerms, emailMarketingOptIn, showAdultContent? }
// onChange(field, value)
function ProfileDetailsFields({ values, errors = {}, onChange, disabled = false, showReferral = true, showAdultSwitch = false, idPrefix = "reg" }) {
  const adult = isAdult(values.dateOfBirth);
  const id = (k) => `${idPrefix}-${k}`;

  return (
    <div className="space-y-4">
      <FormField label="Username" htmlFor={id("username")} error={errors.username} hint="4–50 characters: letters, numbers, _ and -" required>
        <Input
          id={id("username")}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourname"
          value={values.username}
          onChange={(e) => onChange("username", e.target.value)}
          aria-invalid={Boolean(errors.username)}
          disabled={disabled}
        />
      </FormField>

      <FormField label="Date of birth" htmlFor={id("dob")} error={errors.dateOfBirth} hint={`You must be at least ${MIN_AGE}. Adult-content settings unlock at 18.`} required>
        <Input
          id={id("dob")}
          name="dateOfBirth"
          type="date"
          max={maxDateOfBirth(MIN_AGE)}
          value={values.dateOfBirth}
          onChange={(e) => onChange("dateOfBirth", normalizeDateInput(e.target.value))}
          aria-invalid={Boolean(errors.dateOfBirth)}
          disabled={disabled}
        />
      </FormField>

      {showAdultSwitch && adult && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-2/60 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-semibold text-text">Show adult content</p>
            <p className="text-xs text-text-faint">You can change this later in Settings.</p>
          </div>
          <Switch id={id("adult")} checked={Boolean(values.showAdultContent)} onChange={(v) => onChange("showAdultContent", v)} disabled={disabled} label="Show adult content" />
        </div>
      )}

      {showReferral && (
        <FormField label="Referral or gift code" htmlFor={id("promo")} optional>
          <Input
            id={id("promo")}
            name="promoCode"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ENTER CODE"
            value={values.promoCode ?? ""}
            onChange={(e) => onChange("promoCode", e.target.value.toUpperCase())}
            disabled={disabled}
            className="font-mono uppercase tracking-wider"
          />
        </FormField>
      )}

      <div className="space-y-3 pt-1">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            id={id("terms")}
            type="checkbox"
            checked={Boolean(values.acceptedTerms)}
            onChange={(e) => onChange("acceptedTerms", e.target.checked)}
            aria-invalid={Boolean(errors.acceptedTerms)}
            disabled={disabled}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
          />
          <span className="text-sm leading-snug text-text">
            I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-text-link underline underline-offset-2 hover:text-white">Privacy Policy</Link>
            <span className="text-red-400" aria-hidden> *</span>
          </span>
        </label>
        {errors.acceptedTerms && <p role="alert" className="-mt-1 text-xs font-semibold text-red-300">{errors.acceptedTerms}</p>}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            id={id("marketing")}
            type="checkbox"
            checked={Boolean(values.emailMarketingOptIn)}
            onChange={(e) => onChange("emailMarketingOptIn", e.target.checked)}
            disabled={disabled}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
          />
          <span className="text-sm leading-snug text-text-dim">Send me occasional product updates and announcements (optional)</span>
        </label>
      </div>
    </div>
  );
}

export default ProfileDetailsFields;
