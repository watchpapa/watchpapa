import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const Input = forwardRef(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-[46px] w-full rounded-[16px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[12px] text-[22px] font-extrabold text-[#b2b2f6] placeholder:text-[rgba(111,111,220,0.2)] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] outline-none transition focus:border-[#8b8bff] focus:ring-1 focus:ring-[#6f6fdc]",
        className,
      )}
      {...props}
    />
  );
});

export default Input;
