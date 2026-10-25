import { daysBetween } from "../time/dates.js";

export function computeStreaks(dates, today) {
  if (dates.length === 0) {
    return { current: 0, longest: 0, lastWatchedOn: null };
  }

  const lastWatchedOn = dates[dates.length - 1];
  let runLength = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1], dates[i]) !== 1) {
      break;
    }
    runLength++;
  }

  return { current: runLength, longest: runLength, lastWatchedOn };
}
