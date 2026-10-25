import { describe, it, expect } from "vitest";
import { computeStreaks } from "../src/insights/streaks.js";
import { addDays } from "../src/time/dates.js";

// Contract for computeStreaks(dates, today) — decided 2026-10-25:
// - `dates` is an array of `YYYY-MM-DD` strings: days on which the user logged
//   something, already converted to the user's timezone by the caller
// - `today` is `YYYY-MM-DD`, the user's current day (from todayInZone); the
//   function never reads the clock itself
// - returns `{ current, longest, lastWatchedOn }`
// - a streak is a run of consecutive calendar days with at least one log
// - the current streak is alive until the end of today: a run that ends
//   yesterday still counts, a run that ended earlier does not
// - duplicates count once, order does not matter, dates after `today` are ignored
// - an invalid date, a non-array `dates` or an invalid `today` throws a RangeError

const today = "2026-10-25";
const daysAgo = (days) => addDays(today, -days);

describe("computeStreaks with no logs", () => {
  it("returns zero streaks and no last watched day", () => {
    // given
    const dates = [];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 0, longest: 0, lastWatchedOn: null });
  });
});
