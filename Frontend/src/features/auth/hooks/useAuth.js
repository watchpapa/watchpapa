import { useCallback } from "react";
import { supabase } from "../../../lib/supabase.js";

export function useAuth() {
  const signIn = useCallback(async ({ email, password }) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback(
    async ({ email, password, metadata, emailRedirectTo }) => {
      return supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo,
        },
      });
    },
    [],
  );

  const verifyOtp = useCallback(async ({ email, token, type = "signup" }) => {
    return supabase.auth.verifyOtp({ email, token, type });
  }, []);

  const resendOtp = useCallback(async ({ email, type = "signup" }) => {
    return supabase.auth.resend({ email, type });
  }, []);

  const resetPasswordForEmail = useCallback(async ({ email, redirectTo }) => {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }, []);

  const updatePassword = useCallback(async ({ password }) => {
    return supabase.auth.updateUser({ password });
  }, []);

  const signInWithOAuth = useCallback(async ({ provider, redirectTo }) => {
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  }, []);

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  return {
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
    resetPasswordForEmail,
    updatePassword,
    signInWithOAuth,
    signOut,
  };
}
