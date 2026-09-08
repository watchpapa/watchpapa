-- 047_tier_rewards — admin-issued bulk tier rewards + the one-time "you've been
-- upgraded" popup and its notification-bell entry.
--
-- An admin (worker/src/routes/admin/tierRewards.js) grants a higher plan to all
-- active users or a hand-picked set in one action, optionally with a short
-- message. apply_tier_upgrade() (migration 005) does the actual subscription
-- write — upgrade-only, so a reward never downgrades anyone and never clobbers a
-- paid subscription; users already on an equal/higher effective tier are skipped
-- entirely. This table is the per-recipient ledger: the frontend reads
-- unacknowledged rows to show the popup (components/subscription/TierRewardModal)
-- and clears them via acknowledge_tier_rewards(). An AFTER INSERT trigger drops a
-- 'tier_reward' notification so it also persists in the bell after the popup is
-- dismissed.
--
-- The admin action itself is audit-logged by the Worker (audit_events action
-- 'admin_tier_reward'); this table carries no row-trigger audit — the reward rows
-- (batch_id / granted_by / created_at per recipient) are themselves the trail.

-- ─── tier_reward ──────────────────────────────────────────────────────────────
CREATE TABLE public.tier_reward (
  id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id      UUID         NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  batch_id        UUID         NOT NULL,
  tier            TEXT         NOT NULL CHECK (tier IN ('premium', 'pro', 'pro_plus')),
  duration_days   INT          CHECK (duration_days IS NULL OR duration_days > 0),  -- NULL = lifetime
  expires_at      TIMESTAMPTZ,                                                     -- NULL = lifetime; display only
  message         TEXT         CHECK (message IS NULL OR char_length(message) <= 280),
  granted_by      UUID         REFERENCES public.profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX tier_reward_unseen_idx ON public.tier_reward (profile_id) WHERE acknowledged_at IS NULL;
CREATE INDEX tier_reward_batch_idx  ON public.tier_reward (batch_id);

ALTER TABLE public.tier_reward ENABLE ROW LEVEL SECURITY;

-- Recipient reads their own rows. No client INSERT/UPDATE/DELETE policy — the
-- Worker writes via the privileged pooler role (same as user_subscriptions /
-- reward_code_claims), acknowledgement goes through the RPC below. anon matches
-- no policy → denied.
CREATE POLICY "tier_reward: own read"
  ON public.tier_reward FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ─── acknowledge_tier_rewards ─────────────────────────────────────────────────
-- Recipient marks their unseen rewards as seen. Mirrors mark_notifications_read
-- (migration 020). p_ids NULL = every unacknowledged row the caller owns.
CREATE OR REPLACE FUNCTION public.acknowledge_tier_rewards(p_ids BIGINT[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tier_reward
     SET acknowledged_at = (now() AT TIME ZONE 'utc')
   WHERE profile_id = auth.uid()
     AND acknowledged_at IS NULL
     AND (p_ids IS NULL OR id = ANY(p_ids));
END;
$$;

REVOKE ALL     ON FUNCTION public.acknowledge_tier_rewards(BIGINT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acknowledge_tier_rewards(BIGINT[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.acknowledge_tier_rewards(BIGINT[]) TO authenticated;

-- ─── notification.type — allow 'tier_reward' ──────────────────────────────────
ALTER TABLE public.notification DROP CONSTRAINT notification_type_check;
ALTER TABLE public.notification ADD CONSTRAINT notification_type_check
  CHECK (type IN ('new_observer', 'observe_request', 'request_accepted', 'tier_reward'));

-- ─── tier_reward_notify ───────────────────────────────────────────────────────
-- One bell notification per reward row. actor_id is NULL — we don't surface
-- which admin issued it; notificationContent.js renders the 'tier_reward' case
-- with a gift glyph instead of an actor initial.
CREATE OR REPLACE FUNCTION public.tier_reward_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notification (recipient_id, actor_id, type)
  VALUES (NEW.profile_id, NULL, 'tier_reward');
  RETURN NULL;  -- AFTER trigger return value is ignored
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tier_reward_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tier_reward_notify ON public.tier_reward;
CREATE TRIGGER trg_tier_reward_notify
  AFTER INSERT ON public.tier_reward
  FOR EACH ROW EXECUTE FUNCTION public.tier_reward_notify();
