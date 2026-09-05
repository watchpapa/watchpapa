import { cn } from "../../lib/cn.js";

// Label + control + hint/error, with the error wired up for screen readers.
function FormField({ label, htmlFor, error, hint, required = false, optional = false, className, labelClassName, children }) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className={cn("flex items-baseline gap-1.5 text-sm font-semibold text-text", labelClassName)}>
          <span>{label}</span>
          {required && <span className="text-red-400" aria-hidden>*</span>}
          {optional && <span className="text-xs font-normal text-text-faint">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-semibold text-red-300">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export default FormField;
