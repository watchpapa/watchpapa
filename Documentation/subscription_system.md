# Subscription System

watchpapa's subscription system is built entirely inside the database. No tier can be self-assigned — all writes go through `SECURITY DEFINER` functions that run as the database owner.

---

## Tiers

| Tier     | Shows | Movies       | Notes                                                |
|----------|-------|--------------|------------------------------------------------------|
| Free     | 3     | 1            | Default; no row in `user_subscriptions`              |
| Premium  | —     | —            | 10 combined (shows + movies ≤ 10)                    |
| Pro      | 100   | 100          | Separate per-type limits                             |
| Pro+     | 100   | 100          | Same as Pro; placeholder for no-ads when ads exist   |
| God      | ∞     | ∞            | Unlimited; admin-only via Supabase dashboard         |

Hierarchy for upgrade logic: `free < premium < pro < pro_plus < god`

---

## `profile.role` Values

`role` stays on the `profile` table and is not moved or replicated elsewhere.

| Value | Meaning |
|-------|---------|
| 0     | Regular user (default) |
| 4     | Admin |

Users cannot update `role` or `referral_code` via the API — a column-level REVOKE and a BEFORE UPDATE trigger both block it.

---

## Early Adopter Programme

- The first **5,000 users** (counted at profile-insert time) receive lifetime Premium automatically, with `is_early_adopter = true`.
- Early adopters never drop below Premium: `get_effective_tier()` returns `'premium'` when their subscription has expired, rather than `'free'`.
- All users who existed before this system was deployed are retroactively grandfathered — migration 006 backfills them.

---

## How `get_effective_tier` Works

Called from the frontend via `supabase.rpc('get_effective_tier', { p_profile_id: uid })`. It is the single source of truth.

1. No row in `user_subscriptions` → `'free'`
2. `tier = 'god'` → `'god'` (never expires)
3. `expires_at IS NULL OR expires_at > now()` → the stored tier
4. Expired + `is_early_adopter = true` → `'premium'`
5. Expired, not early adopter → `'free'`

---

## Referral Programme

### How to use a referral code

Two ways:
- Register via `watchpapa.tv/register?ref=THEIRCODE` — the code is stored in `sessionStorage` and posted automatically after username setup.
- Open the profile menu → **Use referral code** — enter the code at any time.

### Verification tasks

Both must be met within 30 days:
1. Follow ≥ 3 items (shows + movies combined).
2. Log in on ≥ 2 separate calendar days after using the code.

Login tracking: `record_login_day` RPC is called on every session load. It increments `referrals.login_day_count` (capped at 2) only once per calendar day per pending referral. Once rewarded, the tracking columns are reset.

### Reward matrix

| Referrer type       | Pool status   | Referrer gets      | Referred gets      |
|---------------------|---------------|--------------------|--------------------|
| Anyone              | Slots < 5000  | Pro — 30 days      | Pro — 30 days      |
| Early adopter       | Pool full     | Pro — 30 days      | Premium — 30 days  |
| Non-early-adopter   | Pool full     | Premium — 30 days  | Premium — 30 days  |

### Lifetime Pro milestone

An early adopter who refers ≥ 10 verified users **before `payments_enabled_at` is set** earns lifetime Pro. The flag `earned_pro_plus_on_payments` is set on their `user_subscriptions` row so that when billing launches, they can receive Pro+ for 1 year.

Once `payments_enabled_at` is non-NULL, the milestone is permanently locked — no new grants are made.

---

## Reward Codes

Admin creates codes in the admin panel at `/admin/reward-codes`:

- **Tier**: Premium, Pro, or Pro+ (God is excluded — admin sets that directly in the dashboard).
- **Duration**: days, or blank for a lifetime grant.
- **Max uses per code**: number, or blank for unlimited.
- **Code expiry**: a future date, or blank for no expiry.
- **Count**: how many unique codes to generate (1–1000).

A user claims a code via the profile menu → **Claim reward code**. Each user may claim any given code only once.

---

## Activating Payments

When billing goes live, an admin sets `payments_enabled_at` in the Supabase dashboard:

```sql
UPDATE public.system_settings
SET value = now()::text, updated_at = now()
WHERE key = 'payments_enabled_at';
```

No code deploy is needed. Once set:
- The lifetime Pro milestone is locked permanently.
- Future Pro+ grants for `earned_pro_plus_on_payments` users can be issued externally.

---

## Security Model

### Why users cannot self-upgrade

Three independent layers block self-escalation:

1. **Column-level REVOKE** on `profile`:
   ```sql
   REVOKE UPDATE (role, referral_code) ON public.profile FROM authenticated;
   ```
   The database rejects any `UPDATE profile SET role = 4` from the user's JWT.

2. **No-write RLS** on `user_subscriptions`, `referrals`, `reward_code_claims`: no INSERT, UPDATE, or DELETE policies for `authenticated`. The Supabase API returns 403 for any direct write.

3. **SECURITY DEFINER functions** are the only path to write subscription data. They run as the database owner. Users can EXECUTE `get_effective_tier` and `record_login_day` — both are read-or-no-op from the user's perspective.

### BEFORE UPDATE guard trigger on `profile`

A secondary guard (`guard_profile_columns`) raises `PERMISSION_DENIED` if `role` or `referral_code` are changed while running as the `authenticated` role — covers any edge case not caught by the REVOKE.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profile.referral_code` | One column added to profile — user's shareable invite code |
| `user_subscriptions` | One row per user with a non-free tier. Free users have no row |
| `referrals` | Tracks who invited who; login tracking lives here while pending |
| `reward_codes` | Admin-created promo codes |
| `reward_code_claims` | One claim per user per code (UNIQUE prevents double-claiming) |
| `system_settings` | Admin key-value store; `payments_enabled_at` is the payments gate |
| `user_banner_dismissals` | One row per user per banner; persists dismissal across browsers/devices |

---

## Banner Dismissal System

### `user_banner_dismissals`

Generic store for tracking which banners a user has permanently dismissed. Keyed by `(profile_id, banner_key)` so any new banner can be added without schema changes.

```
profile_id   UUID         FK → profile.id (CASCADE DELETE)
banner_key   TEXT         Identifier for the banner (e.g. 'early_adopter')
dismissed_at TIMESTAMPTZ  When the user dismissed it
```

**RLS**: authenticated users can `SELECT` their own rows only. No direct writes — all inserts go through `dismiss_banner()`.

### `dismiss_banner(p_banner_key TEXT)`

SECURITY DEFINER function. Inserts `(auth.uid(), p_banner_key)` into `user_banner_dismissals`. Idempotent — `ON CONFLICT DO NOTHING` means calling it twice is safe.

**Frontend caching**: `localStorage` (`watchpapa:banner_dismissed:<key>`) acts as a local cache to skip the DB round-trip on subsequent loads in the same browser. The banner component seeds the cache if it finds the DB record already set.

**Adding a new banner**: define a `BANNER_KEY` constant in the component, query `user_banner_dismissals` for it on load, call `supabase.rpc('dismiss_banner', { p_banner_key: BANNER_KEY })` on dismiss. No migration needed.

---

## Migration Execution Order

1. `003_profile_referral_columns.sql` — adds `referral_code`, enables pgcrypto
2. `004_subscription_tables.sql` — all new tables
3. `005_subscription_functions.sql` — SECURITY DEFINER functions
4. `006_profile_insert_trigger.sql` — new-user trigger + backfill
5. `007_follow_limit_trigger.sql` — follow limit enforcement
6. `008_referral_rewards.sql` — reward automation triggers
7. `009_subscription_rls.sql` — RLS policies
8. `010_protect_sensitive_columns.sql` — REVOKE + guard trigger (always last)
9. `011_username_change_limit.sql` — username change cooldown
10. `012_ea_banner_dismissed.sql` — `user_banner_dismissals` table + `dismiss_banner()` function
