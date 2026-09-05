import { twMerge } from "tailwind-merge";

// Class joiner that also resolves Tailwind conflicts (`px-4` vs `px-2`), so a
// caller's `className` reliably overrides a primitive's defaults instead of
// depending on stylesheet source order.
export function cn(...classes) {
  return twMerge(classes.flat().filter(Boolean).join(" "));
}
