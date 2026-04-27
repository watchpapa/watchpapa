import { cn } from "../../lib/cn.js";

function Toggle({ value, onChange, className, disabled = false }) {
  const isYes = value === true;

  return (
    <div
      className={cn(
        "relative inline-flex h-11 w-40 items-center rounded-2xl border border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] p-1 shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]",
        disabled && "opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-1 top-1/2 h-9 w-[76px] -translate-y-1/2 rounded-xl bg-[#6f6fdc]/80 transition-transform duration-200",
          isYes ? "translate-x-[76px] -translate-y-1/2" : "translate-x-0 -translate-y-1/2",
        )}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={cn(
          "relative z-10 h-9 w-[76px] rounded-xl text-center text-[17px] font-extrabold transition",
          isYes ? "text-[#8383e7]" : "text-white",
        )}
        aria-pressed={!isYes}
      >
        NO
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={cn(
          "relative z-10 h-9 w-[76px] rounded-xl text-center text-[17px] font-extrabold transition",
          isYes ? "text-white" : "text-[#8383e7]",
        )}
        aria-pressed={isYes}
      >
        YES
      </button>
    </div>
  );
}

export default Toggle;
