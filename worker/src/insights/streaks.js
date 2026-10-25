import { daysBetween, isValidDateStr } from "../time/dates.js";

export function computeStreaks(dates, today) {
  if (!Array.isArray(dates) || !dates.every(isValidDateStr)) {
    throw new RangeError("dates must be an array of YYYY-MM-DD strings");
  }
  if (!isValidDateStr(today)) {
    throw new RangeError("today must be a YYYY-MM-DD string");
  }

  const streakDays = [...new Set(dates)].filter((date) => date <= today).sort();

  if (streakDays.length === 0) {
    return { current: 0, longest: 0, lastWatchedOn: null };
  }

  let longest = 1;
  let runLength = 1;
  for (let i = 1; i < streakDays.length; i++) {
    if (daysBetween(streakDays[i - 1], streakDays[i]) === 1) {
      runLength++;
    } else {
      runLength = 1;
    }
    longest = Math.max(longest, runLength);
  }

  const lastWatchedOn = streakDays[streakDays.length - 1];
  const isStillAlive = daysBetween(lastWatchedOn, today) <= 1;
  const current = isStillAlive ? runLength : 0;

  return { current, longest, lastWatchedOn };
}
