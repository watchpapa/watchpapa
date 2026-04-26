import { useRef } from "react";
import { cn } from "../../lib/cn.js";

const OTP_LENGTH = 6;

function OtpInput({ value, onChange, className, disabled = false }) {
  const inputsRef = useRef([]);

  const setValueAt = (index, char) => {
    const chars = value.padEnd(OTP_LENGTH, " ").split("");
    chars[index] = char;
    const next = chars.join("").slice(0, OTP_LENGTH).replace(/\s/g, "");
    onChange(next);
  };

  const handleChange = (index) => (event) => {
    const raw = event.target.value;
    const digit = raw.replace(/\D/g, "").slice(-1);

    if (digit) {
      setValueAt(index, digit);
      const nextEl = inputsRef.current[index + 1];
      if (nextEl) nextEl.focus();
    } else {
      setValueAt(index, "");
    }
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      const prevEl = inputsRef.current[index - 1];
      if (prevEl) prevEl.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputsRef.current[lastIndex]?.focus();
  };

  return (
    <div className={cn("flex items-center justify-center gap-[5px] sm:gap-[6px]", className)}>
      {Array.from({ length: OTP_LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[index] ?? ""}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste}
          disabled={disabled}
          className="h-[44px] w-[40px] rounded-[14px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] text-center text-[20px] font-extrabold text-[#b2b2f6] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] outline-none transition focus:border-[#8b8bff] focus:ring-1 focus:ring-[#6f6fdc] disabled:opacity-60 sm:h-[60px] sm:w-[58px] sm:rounded-[16px] sm:text-[28px]"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default OtpInput;
