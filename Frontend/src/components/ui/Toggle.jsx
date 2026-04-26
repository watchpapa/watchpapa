import { cn } from "../../lib/cn.js";

function Toggle({ value, onChange, className, disabled = false }) {
  const isYes = value === true;

  return (
    <div
      className={cn(
        "relative inline-flex h-[46px] w-[156px] items-center rounded-[16px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] p-[3px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]",
        disabled && "opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-[3px] h-[40px] w-[74px] rounded-[12px] bg-[#6f6fdc]/80 transition-transform duration-200",
          isYes ? "translate-x-[74px]" : "translate-x-0",
        )}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={cn(
          "relative z-10 h-[40px] w-[74px] rounded-[12px] text-center text-[18px] font-extrabold transition",
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
          "relative z-10 h-[40px] w-[74px] rounded-[12px] text-center text-[18px] font-extrabold transition",
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
