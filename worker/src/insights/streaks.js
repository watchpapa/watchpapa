import { daysBetween } from "../time/dates.js";

export function computeStreaks(dates, today) {
  if (dates.length === 0) {
    return { current: 0, longest: 0, lastWatchedOn: null };
  }

  let longest = 1;
  let runLength = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) {
      runLength++;
    } else {
      runLength = 1;
    }
    longest = Math.max(longest, runLength);
  }

  const lastWatchedOn = dates[dates.length - 1];
  const isStillAlive = daysBetween(lastWatchedOn, today) <= 1;
  const current = isStillAlive ? runLength : 0;

  return { current, longest, lastWatchedOn };
}
