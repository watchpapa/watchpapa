import { cn } from "../../lib/cn.js";

const SIZES = {
  sm: "h-9 pl-3 pr-8 text-xs",
  md: "h-10 pl-3 pr-9 text-sm",
  lg: "h-12 pl-4 pr-10 text-base",
};

// Styled native <select> (native pickers are the best UX on phones). Value is
// passed back as a string via `onChange(value)`.
function Select({ value, onChange, options, disabled = false, size = "md", className = "", full = false, ...props }) {
  return (
    <span className={cn("relative inline-flex", full && "w-full", className)}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-border-strong bg-surface-3 font-medium text-white transition hover:border-border-hover focus:border-brand-light focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
          SIZES[size] ?? SIZES.md,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}

export default Select;
