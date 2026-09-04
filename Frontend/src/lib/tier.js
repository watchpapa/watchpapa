// Shared subscription-tier helpers. Several files each rolled their own
// `["pro","pro_plus","god"].includes(tier)` check (ProfileStats.jsx,
// useProfileStats.js, generateShareCard.js, ProfileShareCard.jsx) — this is the
// one new shared place; existing call sites are left as-is to avoid unrelated
// churn, but new tier-gated code (avatar upload) uses this.
const PRO_TIERS = new Set(["pro", "pro_plus", "god"]);
const PREMIUM_TIERS = new Set(["premium", "pro", "pro_plus", "god"]);

export function isProTier(tier) {
  return PRO_TIERS.has(tier);
}

export function isPremiumTier(tier) {
  return PREMIUM_TIERS.has(tier);
}
