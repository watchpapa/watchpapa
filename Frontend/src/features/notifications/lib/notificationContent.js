// Maps a notification row to display text and a destination link.
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
    default:
      return { text: "Notification", to: "/notifications" };
  }
}
