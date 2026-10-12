// The only two places the app sets a password. Both run the breached-password
// check (lib/pwned.js) BEFORE calling Supabase, returning a Supabase-shaped
// `{ data, error }` so the forms' existing error handling shows the message.
//
// Plain functions taking the supabase client (not hooks) so they unit-test in
// node — see tests/unit/useAuth-guard.test.js, which also fails the build if
// any other file calls auth.signUp / auth.updateUser({ password }) directly.
import { PWNED_MESSAGE, isPasswordPwned } from "../../../lib/pwned.js";

const pwnedResult = () => ({ data: null, error: { message: PWNED_MESSAGE, code: "pwned_password" } });

export async function signUpWithPwnedCheck(supabase, { email, password, metadata, emailRedirectTo }, pwnedOpts) {
  if (await isPasswordPwned(password, pwnedOpts)) return pwnedResult();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo,
    },
  });
}

export async function updatePasswordWithPwnedCheck(supabase, { password }, pwnedOpts) {
  if (await isPasswordPwned(password, pwnedOpts)) return pwnedResult();
  return supabase.auth.updateUser({ password });
}
