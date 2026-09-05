import { useId, useState } from "react";
import FormField from "../../../../components/ui/FormField.jsx";
import Input from "../../../../components/ui/Input.jsx";
import { EyeIcon, EyeOffIcon } from "../../../../components/icons/index.jsx";
import { cn } from "../../../../lib/cn.js";
import { PASSWORD_RULES, getPasswordPolicyStatus } from "../../../../lib/validate.js";

// Password input with a show/hide toggle (every auth form now has one) and an
// optional live policy checklist for "new password" contexts.
function PasswordField({ id, label = "Password", value, onChange, error, autoComplete = "current-password", showPolicy = false, disabled, placeholder = "••••••••", hint }) {
  const [visible, setVisible] = useState(false);
  const reactId = useId();
  const fieldId = id ?? `pw-${reactId}`;
  const policy = showPolicy ? getPasswordPolicyStatus(value) : null;
  const policyId = `${fieldId}-policy`;

  return (
    <FormField label={label} htmlFor={fieldId} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={fieldId}
          name={fieldId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={showPolicy ? policyId : undefined}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-text-dim transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      {showPolicy && (
        <ul id={policyId} aria-live="polite" className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 text-xs xs:grid-cols-2">
          {PASSWORD_RULES.map((r) => (
            <li key={r.key} className={cn("flex items-center gap-1.5 transition-colors", policy[r.key] ? "text-emerald-400" : "text-text-faint")}>
              <span aria-hidden className="w-3 text-center">{policy[r.key] ? "✓" : "○"}</span>
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </FormField>
  );
}

export default PasswordField;
