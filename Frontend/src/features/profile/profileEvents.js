// Components that change the signed-in user's profile row (avatar, username,
// bio…) dispatch this so CurrentUserProvider refetches and the header updates.
export const PROFILE_UPDATED_EVENT = "watchpapa:profile-updated";

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
}
