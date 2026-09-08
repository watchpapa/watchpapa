import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { tierLabel } from "../../lib/tierMeta.js";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { GiftIcon } from "../icons/index.jsx";

const RANK = ["premium", "pro", "pro_plus"];

// One-time "you've been upgraded" popup. An admin issued a tier reward
// (see /admin/tier-rewards); this reads the recipient's unacknowledged
// public.tier_reward rows, shows the best one, and clears them all on dismiss.
// Mounted once in AppLayout — self-hides when there is nothing to show.
function TierRewardModal({ session }) {
  const uid = session?.user?.id ?? null;
  const { refresh } = useCurrentUser();
  const [rewards, setRewards] = useState([]);
  const acking = useRef(false);

  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    supabase
      .from("tier_reward")
      .select("id, tier, duration_days, expires_at, message, created_at")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) setRewards(data ?? []); });
    return () => { alive = false; };
  }, [uid]);

  const dismiss = useCallback(async () => {
    setRewards([]);
    if (acking.current) return;
    acking.current = true;
    try {
      await supabase.rpc("acknowledge_tier_rewards", { p_ids: null });
    } catch {
      /* best-effort — an unacknowledged row just reappears next visit */
    }
    refresh();
  }, [refresh]);

  const best =
    uid && rewards.length
      ? [...rewards].sort(
          (a, b) => RANK.indexOf(b.tier) - RANK.indexOf(a.tier) || new Date(b.created_at) - new Date(a.created_at),
        )[0]
      : null;

  if (!best) return null;

  const extra = rewards.length - 1;
  const when = best.expires_at
    ? `until ${new Date(best.expires_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`
    : best.duration_days
      ? `for ${best.duration_days} day${best.duration_days === 1 ? "" : "s"}`
      : "for life";

  return (
    <Modal
      open
      onClose={dismiss}
      title={<span />}
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button size="sm" onClick={dismiss}>Got it</Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-brand-light">
          <GiftIcon size={26} />
        </span>
        <div>
          <p className="text-lg font-bold text-white">Your plan is now {tierLabel(best.tier)}</p>
          <p className="mt-0.5 text-sm text-text-muted">Active {when} — on the house.</p>
        </div>
        {best.message && (
          <p className="mt-1 w-full rounded-xl border border-border/50 bg-bg px-4 py-3 text-sm text-text">
            “{best.message}”
          </p>
        )}
        {extra > 0 && (
          <p className="text-xs text-text-faint">+{extra} more reward{extra === 1 ? "" : "s"} on your account.</p>
        )}
      </div>
    </Modal>
  );
}

export default TierRewardModal;
