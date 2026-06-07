-- Allow date_of_birth to be NULL for OAuth users who haven't completed profile setup.
-- The handle_new_user trigger reads raw_user_meta_data->>'date_of_birth', which is
-- NULL for Google/GitHub OAuth users. With NOT NULL on this column the trigger
-- still fails after the username fix, producing "Database error saving new user".
-- OAuth users supply their date of birth on the /complete-username page.

ALTER TABLE public.profile ALTER COLUMN date_of_birth DROP NOT NULL;
