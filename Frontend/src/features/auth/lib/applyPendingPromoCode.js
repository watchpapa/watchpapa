import { API_BASE } from "../../../lib/api.js";

export const PENDING_PROMO_KEY = "pendingPromoCode";

// Try the code as a referral first (404 → it's not a referral) then as a
// reward code. Fire-and-forget: a failed code must never block sign-up.
export async function applyPromoCode(code, accessToken) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized || !accessToken) return;
  const res = await fetch(`${API_BASE}/api/referral/use/${encodeURIComponent(normalized)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
  if (res && !res.ok && res.status === 404) {
    await fetch(`${API_BASE}/api/rewards/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalized }),
    }).catch(() => {});
  }
}

export function stashPendingPromoCode(code) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return;
  try { sessionStorage.setItem(PENDING_PROMO_KEY, normalized); } catch { /* ignore */ }
}

// Apply (and clear) a code stashed before email verification / OAuth completion.
export async function applyPendingPromoCode(session) {
  let code = null;
  try {
    code = sessionStorage.getItem(PENDING_PROMO_KEY);
    if (code) sessionStorage.removeItem(PENDING_PROMO_KEY);
  } catch { /* ignore */ }
  if (!code) return;
  await applyPromoCode(code, session?.access_token);
}
