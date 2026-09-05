import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const SIZES = {
  md: "h-11 px-3.5 text-sm rounded-xl",
  lg: "h-12 px-4 text-base rounded-xl",
};

// Text input. 44px+ tall for touch; `aria-invalid` paints the error state.
const Input = forwardRef(function Input({ className, type = "text", size = "lg", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full border border-border-strong bg-surface-3/80 font-medium text-white placeholder:text-text-faint shadow-sm outline-none transition focus:border-brand-light focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500/70 aria-[invalid=true]:focus:ring-red-500/60",
        SIZES[size] ?? SIZES.lg,
        className,
      )}
      {...props}
    />
  );
});

export default Input;
