import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { API_BASE } from "../../../lib/api.js";
import { TIER_BADGE_VARIANTS, tierLabel } from "../../../lib/tierMeta.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";
import Input from "../../../components/ui/Input.jsx";
import { CheckIcon, CopyIcon, ShareIcon } from "../../../components/icons/index.jsx";

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function PlanSection({ profile, tier, isEarlyAdopter, expiresAt, onClaimed }) {
  const [rewardInput, setRewardInput] = useState("");
  const [rewardError, setRewardError] = useState(null);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardSuccess, setRewardSuccess] = useState(null);
  const [copied, setCopied] = useState(null); // "code" | "link"

  const referralLink = profile?.referral_code ? `${window.location.origin}/register?ref=${profile.referral_code}` : null;

  const copy = (kind, text) => {
    navigator.clipboard?.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClaimReward = async () => {
    const code = rewardInput.trim().toUpperCase();
    if (!code) { setRewardError("Please enter a reward code."); return; }
    setRewardError(null);
    setRewardSaving(true);
    const token = await getToken();
    try {
      const res = await fetch(`${API_BASE}/api/rewards/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setRewardError(body.error ?? "Failed to claim reward code.");
      else { setRewardSuccess(body); onClaimed?.(); }
    } catch {
      setRewardError("Network error. Please try again.");
    }
    setRewardSaving(false);
  };

  return (
    <SettingsSection id="plan" title="Plan & rewards">
      <SettingsRow label="Current plan" hint={expiresAt ? `Active until ${new Date(expiresAt).toLocaleDateString()}.` : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TIER_BADGE_VARIANTS[tier] ?? "neutral"} size="md">{tierLabel(tier)}</Badge>
          {isEarlyAdopter && <Badge variant="gold" size="md">Early Adopter</Badge>}
          <Button to="/subscription" variant="ghost" size="xs">Compare plans</Button>
        </div>
      </SettingsRow>

      <SettingsRow label="Invite friends" hint="Share your code or link — you both get rewarded." stack>
        {profile?.referral_code ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-10 items-center rounded-xl border border-border-strong bg-surface-3 px-3 font-mono text-sm font-semibold tracking-wider text-white">{profile.referral_code}</div>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" icon={copied === "code" ? CheckIcon : CopyIcon} onClick={() => copy("code", profile.referral_code)}>
                {copied === "code" ? "Copied" : "Copy code"}
              </Button>
              <Button variant="secondary" size="md" icon={copied === "link" ? CheckIcon : ShareIcon} onClick={() => copy("link", referralLink)}>
                {copied === "link" ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        ) : (
          <span className="text-sm text-text-faint">—</span>
        )}
      </SettingsRow>

      <SettingsRow label="Claim a reward code" stack>
        {rewardSuccess ? (
          <p className="text-sm font-semibold text-emerald-400">
            {tierLabel(rewardSuccess.tier)}{rewardSuccess.durationDays ? ` for ${rewardSuccess.durationDays} days` : " (lifetime)"} applied!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 sm:max-w-md">
              <Input
                size="md"
                value={rewardInput}
                onChange={(e) => setRewardInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleClaimReward()}
                placeholder="ENTER CODE"
                disabled={rewardSaving}
                className="font-mono uppercase tracking-wider"
                aria-label="Reward code"
              />
              <Button size="md" onClick={handleClaimReward} loading={rewardSaving}>Claim</Button>
            </div>
            {rewardError && <p className="text-xs text-red-300">{rewardError}</p>}
          </div>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

export default PlanSection;
