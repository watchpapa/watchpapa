import { cn } from "../../lib/cn.js";

function FormField({
  label,
  htmlFor,
  error,
  className,
  labelClassName,
  children,
}) {
  return (
    <div className={cn("space-y-[6px]", className)}>
      <label
        htmlFor={htmlFor}
        className={cn("block font-extrabold leading-none text-[#8383e7]", labelClassName)}
      >
        {label}
      </label>
      {children}
      {error ? <p className="text-sm font-semibold text-pink-300">{error}</p> : null}
    </div>
  );
}

export default FormField;
