# Database schema (`public`)

> Generated from the live database (`pg_class`, `pg_policies`, `pg_proc`) on 2026-10-13 and cross-checked against `Backend/src/db/migrations/` (001–048). It replaces the earlier `supabase_public_model.md`, `database_info.md`, `available_public_indexes.md` and the Express-era query audit, which described the TMDB content mirror that no longer exists.
>
> Narrative context, conventions and the per-migration history are in [../../CONTEXT.md](../../CONTEXT.md) ("Database Schema Summary", "Migration History"). To refresh this file, re-run the queries listed at the bottom.

## Principles

- **Only user data is stored.** Movies, shows, seasons, episodes, people, credits and genres are read live from TMDB by the Worker. User rows reference content by `(media_type, tmdb_id)`; there is no foreign key to any content table.
- **RLS is enabled on every `public` table.** The browser (supabase-js) is restricted by policies; the Worker connects through Hyperdrive as the pooler role, which bypasses RLS, so Worker queries scope by the authenticated user id themselves.
- **Writes that must not be client-controlled** (subscriptions, referrals, tier rewards, audit events, rating history, import jobs) have no client write policy; they go through the Worker or `SECURITY DEFINER` functions/triggers.
- `profile.id` is a UUID equal to `auth.users.id`; every other user table uses a `bigint` identity primary key.
- Time columns are `timestamptz`, defaulting to `now() AT TIME ZONE 'utc'`.

## User and social tables

| Table | Purpose | Key columns |
|---|---|---|
| `profile` | One row per account | `id` (= auth user), `username` (nullable until onboarding), `date_of_birth`, `is_adult`, `role` (0 user / 3 editor / 4 admin), `referral_code`, `bio`, `is_private`, `deleted_at`; settings: `setting_display_adult_content`, `setting_show_adult_tab`, `setting_blur_nsfw_posters`, `setting_language`, `setting_title_mode`, `setting_region`, `setting_watch_regions[]`, `setting_watch_providers[]`, `setting_home_row_order[]`, `setting_home_hidden_rows[]`, `setting_bottom_tab_middle`, `setting_allow_profile_share`, `email_marketing_opt_in`; avatar: `avatar_type`, `avatar_poster_*`, `avatar_upload_path`; banner: `banner_favourite_position`, `banner_crop`; `username_changed_at` |
| `user_rating` | A rating (1–10) of a movie, show, season or episode | `profile_id`, `media_type`, `tmdb_id`, `value`; `tmdb_show_id` + `season_number` (+ `episode_number`) for season/episode ratings |
| `user_rating_history` | One row per initial rating and every later change; written only by a trigger | `profile_id`, `media_type`, `tmdb_id`, `value`, `changed_at` |
| `watch_log` | One row per (re)watch of a movie or show | `profile_id`, `media_type`, `tmdb_id`, `watched_at` (date) |
| `watchlist` | A named list | `profile_id`, `name` |
| `watchlist_item` | A title on a list | `watchlist_id`, `media_type`, `tmdb_id`, `watched` (legacy, unused by new code) |
| `profile_favourite` | Up to five pinned favourites | `profile_id`, `position` (1–5), `media_type`, `tmdb_id` |
| `user_followed_movies` / `user_followed_shows` | Follows that feed the calendar | `profile_id`, `tmdb_id` |
| `user_observe` | Observe (follow) relationships between users; `status` is `pending` or `accepted` | `observer_id`, `observed_id`, `accepted_at` |
| `user_block` | Blocks | `blocker_id`, `blocked_id` |
| `notification` | In-app notifications | `recipient_id`, `actor_id` (null for system notifications), `type`, `read_at` |
| `user_banner_dismissals` | Banners a user has dismissed | `profile_id`, `banner_key`, `dismissed_at` |

## Plans, rewards and referrals

| Table | Purpose | Key columns |
|---|---|---|
| `user_subscriptions` | One row per user with a non-free plan (no row = free). Always read through `get_effective_tier()` | `profile_id`, `tier`, `source`, `is_early_adopter`, `earned_pro_plus_on_payments`, `expires_at` |
| `reward_codes` | Promo codes created by admins | `code`, `tier`, `duration_days`, `max_uses`, `current_uses`, `expires_at`, `is_active` |
| `reward_code_claims` | One claim per user per code | `code_id`, `profile_id` |
| `referrals` | Referrer → referred, with verification progress | `referrer_id`, `referred_id`, `status`, `login_day_count`, `last_login_date`, `completed_at` |
| `tier_reward` | Per-recipient ledger of admin bulk rewards (drives the one-time popup) | `profile_id`, `batch_id`, `tier`, `duration_days`, `expires_at`, `message`, `granted_by`, `acknowledged_at` |
| `system_settings` | Key/value flags (e.g. `payments_enabled_at`) | `key`, `value` |

See [../subscription_system.md](../subscription_system.md) for the rules.

## Platform tables

| Table | Purpose | Key columns |
|---|---|---|
| `announcements` | `/updates` posts (HTML body); soft-deleted via `archived` | `title`, `body`, `image_url`, `author_id`, `archived`, `archived_by`, `archived_at` |
| `audit_events` | Audit trail written by the Worker and by DB triggers; 90-day retention | `action`, `user_id`, `target_user_id`, `email`, `ip`, `method`, `path`, `body`, `status`, `source` (`worker`\|`db`) |
| `import_job` | Queue for background CSV imports, advanced by the Worker's cron trigger | `profile_id`, `status`, `payload`, `resolved`, `unresolved`, `resolve_cursor`, `total`, `result`, `error` |

## Empty scaffolding (TMDB mirror)

`movie`, `show`, `season`, `episode`, `person`, `person_aka`, `genres`, `department`, `job`, `movie_credits`, `show_credits`, `episode_credits`, `movie_genre`, `show_genre`, `script_logs` — emptied by migration 031. Their schema, indexes and RLS remain; **nothing reads or writes them**. Any change to them is pointless; drop them in a future migration if the scaffolding is no longer wanted.

## Row-level security summary

| Tables | Policy shape |
|---|---|
| `profile` | Authenticated users can read all profiles (public profile pages); insert and update only their own row. A column-level REVOKE plus trigger blocks changing `role` / `referral_code`; further triggers gate avatar upload and streaming-provider selection by plan |
| `user_rating` | Own insert/update/delete; read through `can_view_ratings(auth.uid(), profile_id)` (honours private accounts and observe relationships) — also open to `anon` through that function |
| `user_rating_history`, `watch_log`, `watchlist`, `watchlist_item`, `user_followed_*`, `import_job`, `tier_reward`, `user_banner_dismissals`, `reward_code_claims`, `user_subscriptions`, `referrals` | Own rows only (`profile_id = auth.uid()`, or either party for `referrals`). `user_rating_history` also allows deleting own entries. `import_job`, `tier_reward`, `user_subscriptions`, `referrals`, `reward_code_claims`, `user_banner_dismissals` are read-only for clients |
| `profile_favourite` | Any authenticated user can read; write own rows |
| `user_observe`, `user_block` | Read own relationships; observers insert; either party may delete an observe row; blockers manage their blocks |
| `notification` | Recipient reads, updates (mark read) and deletes |
| `announcements`, `audit_events`, `reward_codes`, `system_settings` | RLS on with **no client policies** — reachable only through the Worker |
| TMDB-mirror tables | Public `SELECT` (empty tables); `script_logs` readable by admins |

## Functions (RPCs and triggers)

**Callable by the browser (`authenticated`, some also `anon`)** — all `SECURITY DEFINER`:

| Function | Purpose |
|---|---|
| `get_effective_tier(p_profile_id)` | The one source of truth for a user's plan (handles expiry, early adopters, god) |
| `get_limit_status(p_profile_id)` | Follow/watchlist usage vs. plan limits |
| `get_community_rating_stats(p_media_type, p_entity_id)` | Rating histogram / average for a title |
| `get_observed_ratings_for_entity(...)` | Ratings by people the viewer observes |
| `get_activity_feed_v2(p_limit, p_offset)` | Activity feed of observed users |
| `get_observers`, `get_observing`, `get_observe_counts`, `search_profiles`, `respond_observe_request` | Social graph |
| `get_notifications`, `get_unread_notification_count`, `mark_notifications_read` | Notifications |
| `acknowledge_tier_rewards(p_ids)` | Dismiss the tier-reward popup |
| `dismiss_banner`, `record_login_day`, `complete_profile_username`, `delete_account` | Account/onboarding helpers; `delete_account` **soft-deletes** (see CONTEXT.md) |
| `can_view_ratings(p_viewer, p_target)` | Used by the `user_rating` read policy |

**Not callable by clients** (`EXECUTE` revoked): `apply_tier_upgrade`, `_tier_rank`, `check_and_complete_referral`, `check_referral_tasks`, `audit_write`, `audit_skip`, and every trigger function — follow/watchlist limit enforcement (`enforce_follow_limit`, `enforce_watchlist_limit`), username cooldown, referral code and rewards, early-adopter grant, rating history (`log_user_rating_change`), observe/block side effects and notifications, plan guards (`guard_avatar_tier`, `guard_watch_providers_tier`, `guard_profile_sensitive_columns`), tier-reward notification, and the audit triggers (`audit_row_change`, `audit_profile_change`, `audit_user_follow_change`, `audit_notifications_cleared`).

`handle_new_user()` (trigger on `auth.users`, migration 026) creates the profile row at sign-up.

## Other database objects

- **Extensions:** `pg_trgm`, `unaccent` (installed in `public`, included in backups), `pg_cron`.
- **Scheduled job:** `audit-events-90d-cleanup` — daily 02:00 UTC, deletes `audit_events` older than 90 days. It is the only `pg_cron` job.
- **Storage:** public `avatars` bucket (5 MB, jpeg/png/webp); insert/update restricted to the owner's `${uid}/` folder and Pro+ via `get_effective_tier`.
- **Not in the migrations folder:** `profile` and `handle_new_user` were first created in the dashboard; `Backend/src/db/migrations/reference/delete_account.sql` is a reference copy of `delete_account()`.

## Refreshing this document

```sql
-- tables, columns, RLS flag
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by 1;
-- policies
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 1,2;
-- functions and who may execute them
select p.proname, p.prosecdef, has_function_privilege('authenticated', p.oid,'EXECUTE') as auth, has_function_privilege('anon', p.oid,'EXECUTE') as anon
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1;
-- indexes
select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2;
-- scheduled jobs
select jobname, schedule, command from cron.job;
```
