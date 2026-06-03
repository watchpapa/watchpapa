-- Update handle_new_user trigger to copy email_marketing_opt_in from auth metadata to profile
-- This ensures the marketing email opt-in checkbox value from registration is persisted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id, username, date_of_birth, email_marketing_opt_in)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE((NEW.raw_user_meta_data->>'email_marketing_opt_in')::BOOLEAN, FALSE)
  );
  RETURN NEW;
END;
$$;
