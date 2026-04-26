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
        "inline-flex w-full items-center justify-center rounded-2xl border border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-4 py-3 text-lg font-bold text-[#8383e7] shadow-[0_3px_3px_rgba(0,0,0,0.25)] transition hover:text-[#9a9af1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f6fdc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111320] disabled:cursor-not-allowed disabled:opacity-60",
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
