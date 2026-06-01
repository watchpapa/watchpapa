import { cn } from "../../lib/cn.js";

function Button({
  type = "button",
  className,
  children,
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-2xl border border-[#6f6fdc] bg-gradient-to-b from-[#6f6fdc] to-[#4b3bb0] px-4 py-3 text-lg font-bold text-white shadow-[0_8px_24px_-8px_rgba(111,111,220,0.7)] transition hover:from-[#8585ef] hover:to-[#6f6fdc] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b8bff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111320] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
