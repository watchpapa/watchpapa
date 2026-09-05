import { useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidBoolean } from "../../../lib/validate.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Switch from "../../../components/ui/Switch.jsx";
import Button from "../../../components/ui/Button.jsx";

function PrivacySection({ uid, profile, setProfile, blocked, setBlocked }) {
  const [privateBusy, setPrivateBusy] = useState(false);

  const handlePrivateToggle = async (val) => {
    if (privateBusy || !isValidBoolean(val)) return;
    const prev = profile?.is_private ?? false;
    setProfile((p) => ({ ...p, is_private: val }));
    setPrivateBusy(true);
    const { error } = await supabase.from("profile").update({ is_private: val, updated_at: new Date().toISOString() }).eq("id", uid);
    setPrivateBusy(false);
    if (error) setProfile((p) => ({ ...p, is_private: prev }));
  };

  const handleShareToggle = async (val) => {
    if (privateBusy || !isValidBoolean(val)) return;
    const prev = profile?.setting_allow_profile_share ?? false;
    setProfile((p) => ({ ...p, setting_allow_profile_share: val }));
    setPrivateBusy(true);
    const { error } = await supabase.from("profile").update({ setting_allow_profile_share: val, updated_at: new Date().toISOString() }).eq("id", uid);
    setPrivateBusy(false);
    if (error) setProfile((p) => ({ ...p, setting_allow_profile_share: prev }));
  };

  const handleUnblock = async (blockedId) => {
    const prev = blocked;
    setBlocked((list) => list.filter((b) => b.blocked_id !== blockedId));
    const { error } = await supabase.from("user_block").delete().eq("blocker_id", uid).eq("blocked_id", blockedId);
    if (error) setBlocked(prev);
  };

  return (
    <SettingsSection id="privacy" title="Privacy">
      <SettingsRow label="Private account" hint="People must request to observe you; your ratings stay hidden until you approve." htmlFor="pref-private">
        <Switch id="pref-private" checked={profile?.is_private ?? false} onChange={handlePrivateToggle} disabled={privateBusy} label="Private account" />
      </SettingsRow>
      <SettingsRow label="Allow profile sharing" hint="Let anyone generate and download your profile card." htmlFor="pref-share">
        <Switch id="pref-share" checked={profile?.setting_allow_profile_share ?? false} onChange={handleShareToggle} disabled={privateBusy} label="Allow profile sharing" />
      </SettingsRow>
      <SettingsRow label="Blocked users" stack={blocked.length > 0}>
        {blocked.length === 0 ? (
          <span className="text-sm text-text-faint">No blocked users</span>
        ) : (
          <ul className="w-full divide-y divide-border/40 rounded-xl border border-border/50">
            {blocked.map((b) => (
              <li key={b.blocked_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-text">{b.blocked?.username ?? "Unknown"}</span>
                <Button variant="outline" size="xs" onClick={() => handleUnblock(b.blocked_id)}>Unblock</Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

export default PrivacySection;
