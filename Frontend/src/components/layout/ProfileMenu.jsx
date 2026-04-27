import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import Toggle from "../ui/Toggle.jsx";

function isAdult(dateString) {
  if (!dateString) return false;
  const dob = new Date(dateString);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    return age - 1 >= 18;
  }
  return age >= 18;
}

function validateUsername(value) {
  if (!value) return "Username is required.";
  if (value.length < 4) return "At least 4 characters.";
  if (value.length > 50) return "At most 50 characters.";
  return null;
}

const VIEW = { MENU: "menu", USERNAME: "username", DELETE: "delete" };

function ProfileMenu({ session }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(VIEW.MENU);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [adultToggleBusy, setAdultToggleBusy] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const avatarUrl =
    session?.user?.user_metadata?.avatar_url ??
    session?.user?.user_metadata?.picture ??
    null;
  const usernameForAvatar = (profile?.username ?? session?.user?.user_metadata?.username ?? "").trim();
  const initials = (usernameForAvatar[0] ?? session?.user?.email?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!open || !session?.user?.id) return;
    let active = true;
    setProfileLoading(true);
    supabase
      .from("profile")
      .select("username, is_adult, setting_display_adult_content")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(data ?? null);
        setProfileLoading(false);
      });
    return () => { active = false; };
  }, [open, session?.user?.id]);

  useEffect(() => {
    if (!open) {
      setView(VIEW.MENU);
      setNewUsername("");
      setUsernameError(null);
      setDeleteError(null);
    }
  }, [open]);

  useEffect(() => {
    function handleMousedown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleMousedown);
    return () => document.removeEventListener("mousedown", handleMousedown);
  }, [open]);

  const handleAdultToggle = async (val) => {
    if (adultToggleBusy || !session?.user?.id) return;
    const prev = profile?.setting_display_adult_content ?? false;
    setProfile((p) => ({ ...p, setting_display_adult_content: val }));
    setAdultToggleBusy(true);
    const { error } = await supabase
      .from("profile")
      .update({ setting_display_adult_content: val, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    setAdultToggleBusy(false);
    if (error) setProfile((p) => ({ ...p, setting_display_adult_content: prev }));
  };

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim();
    const err = validateUsername(trimmed);
    if (err) { setUsernameError(err); return; }
    setUsernameError(null);
    setUsernameSaving(true);
    const { error: profileError } = await supabase
      .from("profile")
      .update({ username: trimmed, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);

    if (profileError) {
      setUsernameSaving(false);
      const msg = profileError.message?.toLowerCase() ?? "";
      setUsernameError(msg.includes("duplicate key") ? "Username already taken." : profileError.message);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        ...session.user.user_metadata,
        username: trimmed,
      },
    });
    setUsernameSaving(false);

    if (authError) {
      setUsernameError(authError.message ?? "Username saved in profile, but auth metadata update failed.");
      return;
    }

    setProfile((p) => ({ ...p, username: trimmed }));
    setView(VIEW.MENU);
    setNewUsername("");
  };

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
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

  if (!session) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#3a3a7a] bg-[#1a1d35] text-sm font-bold text-[#a0a0e8] transition hover:border-[#7070d0]"
        aria-label="Profile menu"
      >
        {avatarUrl && !avatarLoadFailed ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="h-full w-full object-cover"
            onError={() => setAvatarLoadFailed(true)}
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 origin-top-right animate-[fadeSlideDown_0.15s_ease-out] rounded-2xl border border-[#2a3570] bg-[#0d0f1e] shadow-xl shadow-black/40">
          {profileLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#3a3a7a] border-t-[#8383e7]" />
            </div>
          ) : view === VIEW.MENU ? (
            <MenuView
              profile={profile}
              adultToggleBusy={adultToggleBusy}
              onAdultToggle={handleAdultToggle}
              onChangeUsername={() => {
                setNewUsername(profile?.username ?? "");
                setView(VIEW.USERNAME);
              }}
              onSignOut={handleSignOut}
              onDeleteAccount={() => setView(VIEW.DELETE)}
            />
          ) : view === VIEW.USERNAME ? (
            <UsernameView
              value={newUsername}
              onChange={setNewUsername}
              error={usernameError}
              saving={usernameSaving}
              onSave={handleSaveUsername}
              onBack={() => { setView(VIEW.MENU); setUsernameError(null); }}
            />
          ) : (
            <DeleteView
              deleting={deleting}
              error={deleteError}
              onConfirm={handleDeleteAccount}
              onBack={() => { setView(VIEW.MENU); setDeleteError(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuView({ profile, adultToggleBusy, onAdultToggle, onChangeUsername, onSignOut, onDeleteAccount }) {
  return (
    <div className="p-3 space-y-1">
      <div className="px-2 py-2 border-b border-[#1a1f3a] mb-2">
        <p className="text-xs text-[#6868b8]">Signed in as</p>
        <p className="text-sm font-bold text-white truncate">{profile?.username ?? "—"}</p>
      </div>

      <MenuButton onClick={onChangeUsername} icon={<UsernameIcon />}>
        Change username
      </MenuButton>

      {profile?.is_adult && (
        <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
          <span className="text-sm text-[#c0c0e8]">Adult content</span>
          <div className="scale-[0.55] origin-right">
            <Toggle
              value={profile?.setting_display_adult_content ?? false}
              onChange={onAdultToggle}
              disabled={adultToggleBusy}
            />
          </div>
        </div>
      )}

      <div className="border-t border-[#1a1f3a] pt-1 mt-1 space-y-1">
        <MenuButton onClick={onSignOut} icon={<SignOutIcon />}>
          Sign out
        </MenuButton>
        <MenuButton onClick={onDeleteAccount} icon={<DeleteIcon />} danger>
          Delete account
        </MenuButton>
      </div>
    </div>
  );
}

function UsernameView({ value, onChange, error, saving, onSave, onBack }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="text-[#6868b8] hover:text-white transition">
          <BackIcon />
        </button>
        <p className="text-sm font-bold text-white">Change username</p>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
        placeholder="New username"
        className="w-full rounded-xl border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8] transition"
        disabled={saving}
        autoFocus
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      <button
        onClick={onSave}
        disabled={saving}
        className="mt-3 w-full rounded-xl border border-[#3a3a7a] bg-[#1a1d35] py-2 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

function DeleteView({ deleting, error, onConfirm, onBack }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="text-[#6868b8] hover:text-white transition">
          <BackIcon />
        </button>
        <p className="text-sm font-bold text-white">Delete account</p>
      </div>
      <p className="text-xs text-[#c0c0e8] mb-4 leading-relaxed">
        This will permanently delete your account and all your data. This action cannot be undone.
      </p>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <button
        onClick={onConfirm}
        disabled={deleting}
        className="w-full rounded-xl border border-red-800 bg-red-950/50 py-2 text-xs font-semibold text-red-400 transition hover:border-red-600 hover:text-red-300 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Yes, delete my account"}
      </button>
    </div>
  );
}

function MenuButton({ onClick, icon, children, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
        danger
          ? "text-red-400 hover:bg-red-950/40 hover:text-red-300"
          : "text-[#c0c0e8] hover:bg-[#141728] hover:text-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function UsernameIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default ProfileMenu;
