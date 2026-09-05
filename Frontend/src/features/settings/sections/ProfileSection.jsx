import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { validateMinAge, validateUsername } from "../../../lib/validate.js";
import { notifyProfileUpdated } from "../../profile/profileEvents.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Button from "../../../components/ui/Button.jsx";
import Input from "../../../components/ui/Input.jsx";
import Badge from "../../../components/ui/Badge.jsx";

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

function ProfileSection({ session, uid, profile, setProfile }) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  // Date of birth — write-once. Some accounts (older OAuth sign-ups) have it
  // blank; without it is_adult can never become true, which unlocks the
  // adult-content switches.
  const [dobInput, setDobInput] = useState("");
  const [dobError, setDobError] = useState(null);
  const [dobSaving, setDobSaving] = useState(false);

  const changedAt = profile?.username_changed_at ? new Date(profile.username_changed_at) : null;
  const nextChangeDate = changedAt ? new Date(changedAt.getTime() + NINETY_DAYS) : null;
  const canChange = !nextChangeDate || new Date() >= nextChangeDate;

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim();
    const err = validateUsername(trimmed);
    if (err) { setUsernameError(err); return; }
    setUsernameError(null);
    setUsernameSaving(true);
    const { error: profileError } = await supabase.from("profile").update({ username: trimmed, updated_at: new Date().toISOString() }).eq("id", uid);
    if (profileError) {
      setUsernameSaving(false);
      const msg = profileError.message?.toLowerCase() ?? "";
      setUsernameError(msg.includes("duplicate key") ? "Username already taken." : profileError.message);
      return;
    }
    await supabase.auth.updateUser({ data: { ...session.user.user_metadata, username: trimmed } });
    setUsernameSaving(false);
    setProfile((p) => ({ ...p, username: trimmed }));
    notifyProfileUpdated();
    setEditingUsername(false);
    setUsernameError(null);
  };

  const handleSaveDob = async () => {
    if (!dobInput) { setDobError("Please enter a date of birth."); return; }
    if (new Date(dobInput) > new Date()) { setDobError("Date of birth can't be in the future."); return; }
    if (!validateMinAge(dobInput, 16)) { setDobError("You must be at least 16 years old to use watchpapa."); return; }
    setDobError(null);
    setDobSaving(true);
    const isAdult = validateMinAge(dobInput, 18);
    const { error } = await supabase.from("profile").update({ date_of_birth: dobInput, is_adult: isAdult, updated_at: new Date().toISOString() }).eq("id", uid);
    setDobSaving(false);
    if (error) { setDobError(error.message); return; }
    setProfile((p) => ({ ...p, date_of_birth: dobInput, is_adult: isAdult }));
  };

  return (
    <SettingsSection id="profile" title="Profile">
      <SettingsRow
        label="Username"
        hint={canChange ? "Can be changed once every 90 days." : `Next change available ${nextChangeDate.toLocaleDateString()}.`}
        stack={editingUsername}
      >
        {editingUsername ? (
          <div className="flex w-full flex-col gap-2 sm:max-w-md">
            <Input
              size="md"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveUsername()}
              disabled={usernameSaving}
              aria-invalid={Boolean(usernameError)}
              autoFocus
            />
            {usernameError && <p className="text-xs text-red-300">{usernameError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditingUsername(false); setUsernameError(null); }}>Cancel</Button>
              <Button size="sm" onClick={handleSaveUsername} loading={usernameSaving}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">{profile?.username ?? "—"}</span>
            {canChange ? (
              <Button variant="outline" size="xs" onClick={() => { setNewUsername(profile?.username ?? ""); setEditingUsername(true); }}>Change</Button>
            ) : (
              <Badge size="xs">Locked</Badge>
            )}
          </div>
        )}
      </SettingsRow>

      <SettingsRow
        label="Date of birth"
        hint={
          profile?.date_of_birth
            ? profile.is_adult
              ? "Verified 18+ — unlocks \"Show adult content\" below."
              : "On file, but under 18 — adult content stays unavailable."
            : "Not on file yet (older Google/GitHub sign-ins skipped it). Required to unlock \"Show adult content\"; can't be changed once saved."
        }
      >
        {profile?.date_of_birth ? (
          <span className="text-sm font-semibold text-white">{new Date(profile.date_of_birth).toLocaleDateString()}</span>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input size="md" type="date" value={dobInput} onChange={(e) => setDobInput(e.target.value)} max={new Date().toISOString().slice(0, 10)} disabled={dobSaving} className="w-auto flex-1 sm:w-44" />
              <Button size="md" onClick={handleSaveDob} loading={dobSaving} disabled={!dobInput}>Save</Button>
            </div>
            {dobError && <p className="text-xs text-red-300">{dobError}</p>}
          </div>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

export default ProfileSection;
