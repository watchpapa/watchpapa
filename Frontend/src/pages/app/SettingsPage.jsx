import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { supabase } from "../../lib/supabase.js";
import { validateUsername, isValidBoolean } from "../../lib/validate.js";
import Toggle from "../../components/ui/Toggle.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const TIER_COLORS = {
  free:     "text-[#6868b8]",
  premium:  "text-amber-400",
  pro:      "text-[#9b9bf0]",
  pro_plus: "text-emerald-400",
  god:      "text-rose-400",
};

const TIER_LABELS = {
  free: "Free", premium: "Premium", pro: "Pro", pro_plus: "Pro+", god: "God",
};

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-[#1a1f3a] bg-[#0a0c18]">
      <div className="border-b border-[#1a1f3a] px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">{title}</h2>
      </div>
      <div className="divide-y divide-[#1a1f3a]">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <p className="shrink-0 text-sm font-medium text-[#c0c0e8]">{label}</p>
      <div className="sm:text-right">{children}</div>
    </div>
  );
}

function SettingsPage({ session }) {
  const navigate = useNavigate();
  const uid = session?.user?.id;

  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState("free");
  const [isEarlyAdopter, setIsEarlyAdopter] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);

  // Username
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  // Adult toggle
  const [adultBusy, setAdultBusy] = useState(false);

  // Referral
  const [referralInput, setReferralInput] = useState("");
  const [referralError, setReferralError] = useState(null);
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState(false);

  // Reward
  const [rewardInput, setRewardInput] = useState("");
  const [rewardError, setRewardError] = useState(null);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardSuccess, setRewardSuccess] = useState(null);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const [profileRes, tierRes, subRes] = await Promise.all([
      supabase.from("profile").select("username, is_adult, setting_display_adult_content, referral_code").eq("id", uid).maybeSingle(),
      supabase.rpc("get_effective_tier", { p_profile_id: uid }),
      supabase.from("user_subscriptions").select("is_early_adopter, expires_at").eq("profile_id", uid).maybeSingle(),
    ]);
    setProfile(profileRes.data ?? null);
    setTier(tierRes.data ?? "free");
    setIsEarlyAdopter(subRes.data?.is_early_adopter ?? false);
    setExpiresAt(subRes.data?.expires_at ?? null);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const handleAdultToggle = async (val) => {
    if (adultBusy || !isValidBoolean(val)) return;
    const prev = profile?.setting_display_adult_content ?? false;
    setProfile((p) => ({ ...p, setting_display_adult_content: val }));
    setAdultBusy(true);
    const { error } = await supabase.from("profile")
      .update({ setting_display_adult_content: val, updated_at: new Date().toISOString() })
      .eq("id", uid);
    setAdultBusy(false);
    if (error) setProfile((p) => ({ ...p, setting_display_adult_content: prev }));
  };

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim();
    const err = validateUsername(trimmed);
    if (err) { setUsernameError(err); return; }
    setUsernameError(null);
    setUsernameSaving(true);
    const { error: profileError } = await supabase.from("profile")
      .update({ username: trimmed, updated_at: new Date().toISOString() })
      .eq("id", uid);
    if (profileError) {
      setUsernameSaving(false);
      const msg = profileError.message?.toLowerCase() ?? "";
      setUsernameError(msg.includes("duplicate key") ? "Username already taken." : profileError.message);
      return;
    }
    await supabase.auth.updateUser({ data: { ...session.user.user_metadata, username: trimmed } });
    setUsernameSaving(false);
    setProfile((p) => ({ ...p, username: trimmed }));
    setEditingUsername(false);
    setUsernameError(null);
  };

  const handleUseReferral = async () => {
    const code = referralInput.trim().toUpperCase();
    if (!code) { setReferralError("Please enter a referral code."); return; }
    setReferralError(null);
    setReferralSaving(true);
    const token = await getToken();
    try {
      const res = await fetch(`${API_BASE}/api/referral/use/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setReferralError(body.error ?? "Failed to apply referral code.");
      else setReferralSuccess(true);
    } catch {
      setReferralError("Network error. Please try again.");
    }
    setReferralSaving(false);
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
      else { setRewardSuccess(body); load(); }
    } catch {
      setRewardError("Network error. Please try again.");
    }
    setRewardSaving(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_account");
    if (error) {
      setDeleting(false);
      setDeleteError(error.message ?? "Failed to delete account.");
      return;
    }
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <AppLayout session={session} breadcrumbs={[{ label: "Settings", to: "/settings" }]}>
        <div className="flex items-center justify-center py-20">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#3a3a7a] border-t-[#8383e7]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Settings", to: "/settings" }]}>
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>

        {/* Profile */}
        <Section title="Profile">
          <Row label="Username">
            {editingUsername ? (
              <div className="flex flex-col items-end gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
                  className="w-full rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8] transition"
                  disabled={usernameSaving}
                  autoFocus
                />
                {usernameError && <p className="text-xs text-red-400">{usernameError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameError(null); }}
                    className="rounded-lg border border-[#2a3570] px-3 py-1.5 text-xs text-[#6868b8] transition hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUsername}
                    disabled={usernameSaving}
                    className="rounded-lg border border-[#6868b8] bg-[#12163a] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#9b9bf0] hover:text-white disabled:opacity-50"
                  >
                    {usernameSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-[#b0b0d4]">{profile?.username ?? "—"}</span>
                <button
                  onClick={() => { setNewUsername(profile?.username ?? ""); setEditingUsername(true); }}
                  className="text-xs text-[#6868b8] underline transition hover:text-white"
                >
                  Change
                </button>
              </div>
            )}
          </Row>
        </Section>

        {/* Preferences */}
        {profile?.is_adult && (
          <Section title="Preferences">
            <Row label="Show adult content">
              <Toggle
                value={profile?.setting_display_adult_content ?? false}
                onChange={handleAdultToggle}
                disabled={adultBusy}
              />
            </Row>
          </Section>
        )}

        {/* Subscription */}
        <Section title="Plan">
          <Row label="Current plan">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`text-sm font-semibold ${TIER_COLORS[tier] ?? "text-[#6868b8]"}`}>
                {TIER_LABELS[tier] ?? tier}
              </span>
              {isEarlyAdopter && (
                <span className="rounded border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                  Early Adopter
                </span>
              )}
              {expiresAt && (
                <span className="text-xs text-[#5a5a78]">
                  until {new Date(expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </Row>

          <Row label="Your referral code">
            {profile?.referral_code ? (
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono text-sm font-semibold text-[#b0b0d4]">{profile.referral_code}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(profile.referral_code)}
                  className="text-xs text-[#6868b8] underline transition hover:text-white"
                >
                  Copy
                </button>
              </div>
            ) : (
              <span className="text-sm text-[#5a5a78]">—</span>
            )}
          </Row>

          <Row label="Use a referral code">
            {referralSuccess ? (
              <p className="text-xs font-semibold text-emerald-400">Applied! Rewards unlock once your friend completes the verification steps.</p>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleUseReferral()}
                    placeholder="ENTER CODE"
                    className="w-36 rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-sm font-mono text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8] transition"
                    disabled={referralSaving}
                  />
                  <button
                    onClick={handleUseReferral}
                    disabled={referralSaving}
                    className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
                  >
                    {referralSaving ? "Applying…" : "Apply"}
                  </button>
                </div>
                {referralError && <p className="text-xs text-red-400">{referralError}</p>}
              </div>
            )}
          </Row>

          <Row label="Claim a reward code">
            {rewardSuccess ? (
              <p className="text-xs font-semibold text-emerald-400">
                {TIER_LABELS[rewardSuccess.tier] ?? rewardSuccess.tier}
                {rewardSuccess.durationDays ? ` for ${rewardSuccess.durationDays} days` : " (lifetime)"} applied!
              </p>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rewardInput}
                    onChange={(e) => setRewardInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleClaimReward()}
                    placeholder="ENTER CODE"
                    className="w-36 rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-1.5 text-sm font-mono text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8] transition"
                    disabled={rewardSaving}
                  />
                  <button
                    onClick={handleClaimReward}
                    disabled={rewardSaving}
                    className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
                  >
                    {rewardSaving ? "Claiming…" : "Claim"}
                  </button>
                </div>
                {rewardError && <p className="text-xs text-red-400">{rewardError}</p>}
              </div>
            )}
          </Row>
        </Section>

        {/* Danger zone */}
        <Section title="Account">
          <Row label="Delete account">
            {deleteConfirm ? (
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-[#c0c0e8]">This permanently deletes all your data. Are you sure?</p>
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                    className="rounded-lg border border-[#2a3570] px-3 py-1.5 text-xs text-[#6868b8] transition hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:border-red-600 hover:text-red-300 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="text-xs font-semibold text-red-500 underline transition hover:text-red-400"
              >
                Delete my account
              </button>
            )}
          </Row>
        </Section>
      </div>
    </AppLayout>
  );
}

export default SettingsPage;
