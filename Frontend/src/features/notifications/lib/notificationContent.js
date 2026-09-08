import { GiftIcon } from "../../../components/icons/index.jsx";

// Maps a notification row to display text, a destination link, and (for
// actor-less system notifications) an icon to show instead of an actor initial.
// Kept standalone (not in a page module) to avoid circular imports between
// the navbar bell and the notifications page.
export function notificationContent(n) {
  const name = n.actor_username ?? "Someone";
  switch (n.type) {
    case "new_observer":
      return { text: `${name} started observing you`, to: n.actor_username ? `/u/${n.actor_username}` : "/notifications" };
    case "observe_request":
      return { text: `${name} requested to observe you`, to: "/observe-requests" };
    case "request_accepted":
      return { text: `${name} accepted your observe request`, to: n.actor_username ? `/u/${n.actor_username}` : "/notifications" };
    case "tier_reward":
      return { text: "You've been given a plan upgrade", to: "/subscription", icon: GiftIcon };
    default:
      return { text: "Notification", to: "/notifications" };
  }
}
