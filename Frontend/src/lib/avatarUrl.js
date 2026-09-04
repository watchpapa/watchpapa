import { supabase } from "./supabase.js";

// Public CDN URL for an uploaded avatar object path (e.g. "<uid>/avatar.jpg").
// getPublicUrl() is synchronous (just string-builds the URL, no request) and
// works because the "avatars" bucket is public — see migration 033.
export function avatarUploadUrl(path) {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data?.publicUrl ?? null;
}
