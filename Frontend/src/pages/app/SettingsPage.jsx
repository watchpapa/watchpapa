import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { supabase } from "../../lib/supabase.js";
import { apiFetch } from "../../lib/api.js";
import { validateUsername, isValidBoolean } from "../../lib/validate.js";
import Toggle from "../../components/ui/Toggle.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const TIER_COLORS = {
  free:     "text-green-400",
  premium:  "text-amber-400",
  pro:      "text-sky-400",
  pro_plus: "text-violet-400",
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
    <section className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
      <div className="border-b border-[#2a3570]/50 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">{title}</h2>
      </div>
      <div className="divide-y divide-[#2a3570]/40">{children}</div>
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

  // Marketing opt-in toggle
  const [marketingBusy, setMarketingBusy] = useState(false);

  // Privacy
  const [privateBusy, setPrivateBusy] = useState(false);
  const [blocked, setBlocked] = useState([]);

  // Reward
  const [rewardInput, setRewardInput] = useState("");
  const [rewardError, setRewardError] = useState(null);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardSuccess, setRewardSuccess] = useState(null);

  // Copy referral
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Sync status

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [showDeletedModal, setShowDeletedModal] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const [profileRes, tierRes, subRes, blockedRes] = await Promise.all([
      supabase.from("profile").select("username, is_adult, is_private, setting_display_adult_content, setting_allow_profile_share, email_marketing_opt_in, referral_code, username_changed_at").eq("id", uid).maybeSingle(),
      supabase.rpc("get_effective_tier", { p_profile_id: uid }),
      supabase.from("user_subscriptions").select("is_early_adopter, expires_at").eq("profile_id", uid).maybeSingle(),
      supabase.from("user_block").select("blocked_id, created_at, blocked:blocked_id(id, username)").eq("blocker_id", uid).order("created_at", { ascending: false }),
    ]);
    setProfile(profileRes.data ?? null);
    setTier(tierRes.data ?? "free");
    setIsEarlyAdopter(subRes.data?.is_early_adopter ?? false);
    setExpiresAt(subRes.data?.expires_at ?? null);
    setBlocked(blockedRes.data ?? []);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      // The Worker returns rows keyed by tmdb_id; hydrate title/year here, then
      // compose the watchpapa CSV client-side.
      const { ratings, watchlistItems } = await apiFetch("/api/import/export", { session });

      const ids = [
        ...new Set([...ratings, ...watchlistItems].map((r) => Number(r.tmdb_id))),
      ].map((id) => ({ type: "movie", id }));

      const cards = {};
      for (let i = 0; i < ids.length; i += 18) {
        const { cards: c } = await apiFetch("/api/content/batch", {
          session,
          method: "POST",
          body: JSON.stringify({ items: ids.slice(i, i + 18) }),
        });
        Object.assign(cards, c);
      }
      const meta = (tmdbId) => cards[`movie:${Number(tmdbId)}`] ?? {};

      const esc = (v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = [];
      const ratedByTmdb = new Map(ratings.map((r) => [Number(r.tmdb_id), r]));
      const seen = new Set();
      for (const w of watchlistItems) {
        const m = meta(w.tmdb_id);
        seen.add(Number(w.tmdb_id));
        const rating = ratedByTmdb.get(Number(w.tmdb_id));
        rows.push([(w.added_at ?? "").slice(0, 10), m.title ?? "", m.year ?? "", "movie", w.watchlist_name, rating?.value ?? "", w.watched ? "true" : "false"]);
      }
      for (const r of ratings) {
        if (seen.has(Number(r.tmdb_id))) continue;
        const m = meta(r.tmdb_id);
        rows.push([(r.created_at ?? "").slice(0, 10), m.title ?? "", m.year ?? "", "movie", "", r.value, ""]);
      }

      const csv =
        "Date,Name,Year,MediaType,WatchlistName,Rating,Watched\n" +
        rows.map((row) => row.map(esc).join(",")).join("\n");

      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchpapa-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e?.message ?? "Export failed. Please try again.");
    }
    setExporting(false);
  };

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

  const handleMarketingOptIn = async (val) => {
    if (marketingBusy || !isValidBoolean(val)) return;
    const prev = profile?.email_marketing_opt_in ?? false;
    setProfile((p) => ({ ...p, email_marketing_opt_in: val }));
    setMarketingBusy(true);
    const { error } = await supabase.from("profile")
      .update({ email_marketing_opt_in: val, updated_at: new Date().toISOString() })
      .eq("id", uid);
    setMarketingBusy(false);
    if (error) setProfile((p) => ({ ...p, email_marketing_opt_in: prev }));
  };

  const handlePrivateToggle = async (val) => {
    if (privateBusy || !isValidBoolean(val)) return;
    const prev = profile?.is_private ?? false;
    setProfile((p) => ({ ...p, is_private: val }));
    setPrivateBusy(true);
    const { error } = await supabase.from("profile")
      .update({ is_private: val, updated_at: new Date().toISOString() })
      .eq("id", uid);
    setPrivateBusy(false);
    if (error) setProfile((p) => ({ ...p, is_private: prev }));
  };

  const handleShareToggle = async (val) => {
    if (privateBusy || !isValidBoolean(val)) return;
    const prev = profile?.setting_allow_profile_share ?? false;
    setProfile((p) => ({ ...p, setting_allow_profile_share: val }));
    setPrivateBusy(true);
    const { error } = await supabase.from("profile")
      .update({ setting_allow_profile_share: val, updated_at: new Date().toISOString() })
      .eq("id", uid);
    setPrivateBusy(false);
    if (error) setProfile((p) => ({ ...p, setting_allow_profile_share: prev }));
  };

  const handleUnblock = async (blockedId) => {
    const prev = blocked;
    setBlocked((list) => list.filter((b) => b.blocked_id !== blockedId));
    const { error } = await supabase.from("user_block")
      .delete()
      .eq("blocker_id", uid)
      .eq("blocked_id", blockedId);
    if (error) setBlocked(prev);
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
    setDeleting(false);
    setShowDeletedModal(true);
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
            ) : (() => {
              const changedAt = profile?.username_changed_at ? new Date(profile.username_changed_at) : null;
              const nextChangeDate = changedAt ? new Date(changedAt.getTime() + 90 * 24 * 60 * 60 * 1000) : null;
              const canChange = !nextChangeDate || new Date() >= nextChangeDate;
              return (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#b0b0d4]">{profile?.username ?? "—"}</span>
                    {canChange ? (
                      <button
                        onClick={() => { setNewUsername(profile?.username ?? ""); setEditingUsername(true); }}
                        className="text-xs text-[#6868b8] underline transition hover:text-white"
                      >
                        Change
                      </button>
                    ) : (
                      <span className="text-xs text-[#5a5a78]">Locked</span>
                    )}
                  </div>
                  {canChange ? (
                    <p className="text-[11px] text-[#5a5a78]">Can be changed once every 90 days.</p>
                  ) : (
                    <p className="text-[11px] text-[#5a5a78]">
                      Next change available {nextChangeDate.toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })()}
          </Row>
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          {profile?.is_adult && (
            <Row label="Show adult content">
              <Toggle
                value={profile?.setting_display_adult_content ?? false}
                onChange={handleAdultToggle}
                disabled={adultBusy}
              />
            </Row>
          )}
          <Row label="Product updates & announcements">
            <Toggle
              value={profile?.email_marketing_opt_in ?? false}
              onChange={handleMarketingOptIn}
              disabled={marketingBusy}
            />
          </Row>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <Row label="Private account">
            <div className="flex flex-col items-end gap-1">
              <Toggle
                value={profile?.is_private ?? false}
                onChange={handlePrivateToggle}
                disabled={privateBusy}
              />
              <p className="max-w-[16rem] text-[11px] text-[#5a5a78]">
                When on, people must request to observe you and your ratings stay hidden until you approve.
              </p>
            </div>
          </Row>
          <Row label="Allow profile sharing">
            <div className="flex flex-col items-end gap-1">
              <Toggle
                value={profile?.setting_allow_profile_share ?? false}
                onChange={handleShareToggle}
                disabled={privateBusy}
              />
              <p className="max-w-[16rem] text-[11px] text-[#5a5a78]">
                Let anyone generate and download your profile card to share.
              </p>
            </div>
          </Row>
          <Row label="Blocked users">
            {blocked.length === 0 ? (
              <span className="text-sm text-[#5a5a78]">No blocked users</span>
            ) : (
              <div className="flex w-full flex-col items-end gap-2">
                {blocked.map((b) => (
                  <div key={b.blocked_id} className="flex w-full items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm text-[#b0b0d4]">{b.blocked?.username ?? "Unknown"}</span>
                    <button
                      onClick={() => handleUnblock(b.blocked_id)}
                      className="rounded-lg border border-[#2a3570] px-3 py-1 text-xs font-semibold text-[#6868b8] transition hover:border-[#5a5aaa] hover:text-white"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Row>
        </Section>

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
              <div className="flex flex-col items-end gap-1.5">
                <span className="font-mono text-sm font-semibold text-[#b0b0d4]">{profile.referral_code}</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(profile.referral_code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-xs transition hover:text-white underline text-[#6868b8]"
                  >
                    {copiedCode ? <span className="text-emerald-400 no-underline">Copied!</span> : "Copy code"}
                  </button>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/register?ref=${profile.referral_code}`;
                      navigator.clipboard?.writeText(link);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="text-xs transition hover:text-white underline text-[#6868b8]"
                  >
                    {copiedLink ? <span className="text-emerald-400 no-underline">Copied!</span> : "Copy link"}
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-sm text-[#5a5a78]">—</span>
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

        {/* Data import / export */}
        <Section title="Data">
          <Row label="Import data">
            <Link
              to="/import"
              className="text-xs font-semibold text-[#6868b8] underline transition hover:text-white"
            >
              Import from Letterboxd or watchpapa CSV
            </Link>
          </Row>
          <Row label="Export my data">
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
              >
                {exporting ? "Preparing…" : "Download CSV"}
              </button>
              {exportError && <p className="text-xs text-red-400">{exportError}</p>}
              <p className="text-[11px] text-[#5a5a78]">Ratings and watchlist in watchpapa CSV format.</p>
            </div>
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
                onClick={() => { setDeleteConfirm(true); setDeleteError(null); }}
                className="text-xs font-semibold text-red-500 underline transition hover:text-red-400"
              >
                Delete my account
              </button>
            )}
          </Row>
        </Section>
      </div>

      {showDeletedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2a2d60] bg-[#0d0f1e] p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-extrabold text-white">Account deleted</h2>
            <p className="mb-1 text-sm text-[#8888c8]">
              Your account has been successfully deleted.
            </p>
            <p className="mb-6 text-sm text-[#5a5a78]">
              Your remaining data will be permanently removed within 30 days.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login", { replace: true });
              }}
              className="w-full rounded-xl border border-[#5050b0] bg-[#2a2d60] py-2.5 text-sm font-bold text-white transition hover:bg-[#3a3d80]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default SettingsPage;
