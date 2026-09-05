import { cn } from "../../lib/cn.js";

// Label (+ optional hint) on the left, control on the right. Stacks below
// `sm`; `stack` forces the stacked layout at every width (wide controls like
// the provider grid or the home-row editor).
function SettingsRow({ label, hint, htmlFor, children, stack = false, className }) {
  return (
    <div className={cn("gap-3 px-4 py-4 sm:px-5", stack ? "flex flex-col" : "flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className={cn("min-w-0", !stack && "sm:max-w-[55%]")}>
        <label htmlFor={htmlFor} className="block text-sm font-medium text-text">{label}</label>
        {hint && <p className="mt-0.5 text-xs leading-snug text-text-faint">{hint}</p>}
      </div>
      <div className={cn("min-w-0", !stack && "sm:flex sm:shrink-0 sm:justify-end")}>{children}</div>
    </div>
  );
}

export default SettingsRow;
