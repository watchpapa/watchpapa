import { cn } from "../../lib/cn.js";

// Compact on/off switch (44×24 track, 40px+ hit area) — replaces the 176px
// NO/YES `Toggle` in dense settings rows. Controlled: `checked` + `onChange(bool)`.
function Switch({ checked = false, onChange, disabled = false, label, className, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "group relative inline-flex h-10 w-14 shrink-0 items-center justify-center focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors group-focus-visible:ring-2 group-focus-visible:ring-brand-light group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg",
          checked ? "border-brand bg-brand" : "border-border-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}

export default Switch;
