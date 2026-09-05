import { cn } from "../../../../lib/cn.js";

// The one auth card shell (login, register, verify, forgot, reset, complete
// profile all use it). `width="md"` for the two-column-capable register step.
function AuthCard({ title, subtitle, children, footer, width = "sm", className, ...formProps }) {
  const Tag = formProps.onSubmit ? "form" : "div";
  return (
    <Tag
      noValidate={formProps.onSubmit ? true : undefined}
      className={cn(
        "w-full rounded-2xl border border-border bg-surface/85 p-5 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-7",
        width === "md" ? "max-w-[520px]" : "max-w-[440px]",
        className,
      )}
      {...formProps}
    >
      {(title || subtitle) && (
        <header className="mb-5 text-center">
          {title && <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-[28px]">{title}</h1>}
          {subtitle && <p className="mt-1.5 text-sm text-text-dim">{subtitle}</p>}
        </header>
      )}
      {children}
      {footer && <div className="mt-5 text-center text-sm text-text-dim">{footer}</div>}
    </Tag>
  );
}

export default AuthCard;
