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

describe("computeStreaks with a single log", () => {
  it("counts one log today as a streak of one", () => {
    // given
    const dates = [today];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 1, longest: 1, lastWatchedOn: today });
  });
});

describe("computeStreaks with consecutive days ending today", () => {
  it("counts two consecutive days", () => {
    // given
    const dates = [daysAgo(1), today];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 2, longest: 2, lastWatchedOn: today });
  });

  it("counts three consecutive days", () => {
    // given
    const dates = [daysAgo(2), daysAgo(1), today];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 3, longest: 3, lastWatchedOn: today });
  });
});

describe("computeStreaks with gaps and the end-of-today grace period", () => {
  it("starts a new streak of one after a gap", () => {
    // given: a log today and one three days ago
    const dates = [daysAgo(3), today];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 1, longest: 1, lastWatchedOn: today });
  });

  it("keeps the streak alive when the last log was yesterday", () => {
    // given: nothing logged yet today, the day is not over
    const dates = [daysAgo(2), daysAgo(1)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 2, longest: 2, lastWatchedOn: daysAgo(1) });
  });

  it("breaks the current streak when the last log was two days ago", () => {
    // given: a run that ended before yesterday
    const dates = [daysAgo(3), daysAgo(2)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 0, longest: 2, lastWatchedOn: daysAgo(2) });
  });
});

describe("computeStreaks longest streak", () => {
  it("keeps an older, longer run as the longest streak", () => {
    // given: a run of five, a gap, then a run of two ending today
    const dates = [
      daysAgo(9), daysAgo(8), daysAgo(7), daysAgo(6), daysAgo(5),
      daysAgo(1), today,
    ];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 2, longest: 5, lastWatchedOn: today });
  });
});

describe("computeStreaks with messy input", () => {
  it("counts several logs on the same day once", () => {
    // given
    const dates = [today, today, today];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 1, longest: 1, lastWatchedOn: today });
  });

  it("gives the same result for unsorted input", () => {
    // given: the three consecutive days in scrambled order
    const dates = [today, daysAgo(2), daysAgo(1)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 3, longest: 3, lastWatchedOn: today });
  });

  it("ignores logs dated after today", () => {
    // given: two real days plus two days in the future
    const dates = [daysAgo(1), today, addDays(today, 1), addDays(today, 2)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 2, longest: 2, lastWatchedOn: today });
  });

  it("returns no streaks when every log is in the future", () => {
    // given
    const dates = [addDays(today, 1)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result).toEqual({ current: 0, longest: 0, lastWatchedOn: null });
  });
});

describe("computeStreaks across calendar boundaries", () => {
  it("treats the last day of a year and the first of the next as consecutive", () => {
    // given
    const dates = ["2026-12-31", "2027-01-01"];
    // when
    const result = computeStreaks(dates, "2027-01-01");
    // then
    expect(result).toEqual({ current: 2, longest: 2, lastWatchedOn: "2027-01-01" });
  });

  it("treats February 29 as a day between February 28 and March 1", () => {
    // given
    const dates = ["2028-02-28", "2028-02-29", "2028-03-01"];
    // when
    const result = computeStreaks(dates, "2028-03-01");
    // then
    expect(result).toEqual({ current: 3, longest: 3, lastWatchedOn: "2028-03-01" });
  });
});

describe("computeStreaks depends on the user's today", () => {
  it.each([
    ["2026-10-25", 2],
    ["2026-10-26", 2],
    ["2026-10-27", 0],
  ])("with today %s the current streak is %i", (userToday, expectedCurrent) => {
    // given: the same two logs, seen from users whose local day differs
    const dates = ["2026-10-24", "2026-10-25"];
    // when
    const result = computeStreaks(dates, userToday);
    // then
    expect(result.current).toBe(expectedCurrent);
  });
});

describe("computeStreaks lastWatchedOn", () => {
  it("is the latest day that is not in the future", () => {
    // given
    const dates = [daysAgo(5), daysAgo(2), addDays(today, 3)];
    // when
    const result = computeStreaks(dates, today);
    // then
    expect(result.lastWatchedOn).toBe(daysAgo(2));
  });
});
