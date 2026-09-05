// Display metadata for subscription tiers (labels + colours), shared by the
// account menu, profile header, and Settings → Plan.
export const TIER_LABELS = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
  pro_plus: "Pro+",
  god: "God",
};

export const TIER_TEXT_COLORS = {
  free: "text-emerald-400",
  premium: "text-amber-400",
  pro: "text-sky-400",
  pro_plus: "text-violet-400",
  god: "text-rose-400",
};

export const TIER_BADGE_VARIANTS = {
  free: "success",
  premium: "warning",
  pro: "info",
  pro_plus: "brand",
  god: "danger",
};

export function tierLabel(tier) {
  return TIER_LABELS[tier] ?? tier ?? "Free";
}
