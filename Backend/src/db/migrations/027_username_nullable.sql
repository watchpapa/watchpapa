-- Allow username to be NULL for OAuth users who haven't completed profile setup yet.
-- The handle_new_user trigger inserts raw_user_meta_data->>'username', which is NULL
-- for Google/GitHub OAuth users (they provide no username in their OAuth metadata).
-- With username NOT NULL, the trigger fails → "Database error saving new user" redirect.
-- Making it nullable lets the trigger succeed; the NULL username is detected by the
-- frontend (needsUsernameSetup = true) which gates the user to /complete-username.
-- The UNIQUE index already allows multiple NULLs in PostgreSQL.

ALTER TABLE public.profile ALTER COLUMN username DROP NOT NULL;

-- Fix the one existing stuck OAuth user who got an empty-string username
-- (created before this migration, from an older trigger version).
-- Empty string is treated identically to NULL by the frontend username check,
-- but NULL is the canonical "no username" state going forward.
UPDATE public.profile SET username = NULL WHERE username = '';
