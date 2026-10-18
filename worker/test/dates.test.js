import { describe, it, expect } from "vitest";
import {
  isValidDateStr,
  addDays,
  daysBetween,
  isValidTimeZone,
  todayInZone,
} from "../src/time/dates.js";



// Contract for isValidDateStr(dateStr): decided 2026-10-18:
// - exactly `YYYY-MM-DD`,
// - zero-padded,
// - no surrounding whitespace,
// - the date must exist on the calendar.

describe("isValidDateStr", () => {
  describe("well-formed dates", () => {
    it("returns true for a zero-padded YYYY-MM-DD date", () => {
      // given
      const input = "2026-10-17";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(true);
    });
  });

  describe("wrong format", () => {
    it("returns false when month and day are not zero-padded", () => {
      // given
      const input = "2026-1-7";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns false when the parts are separated by slashes", () => {
      // given
      const input = "2026/10/17";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns false when the order is day-month-year", () => {
      // given
      const input = "17-10-2026";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns false for an empty string", () => {
      // given
      const input = "";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns false when there is surrounding whitespace", () => {
      // given
      const input = " 2026-10-17 ";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });
  });

  describe("non-string input", () => {
    it.each([[null], [undefined], [20261017], [{}]])(
      "returns false for %p",
      (input) => {
        // given: the non-string input from the table above
        // when
        const result = isValidDateStr(input);
        // then
        expect(result).toBe(false);
      },
    );
  });

  describe("dates that do not exist", () => {
    it.each([["2026-13-01"], ["2026-00-10"]])(
      "returns false for the impossible month in %s",
      (input) => {
        // given: a date whose month is outside 01-12
        // when
        const result = isValidDateStr(input);
        // then
        expect(result).toBe(false);
      },
    );

    it.each([["2026-10-00"], ["2026-10-32"]])(
      "returns false for the impossible day in %s",
      (input) => {
        // given: a date whose day is outside 01-31
        // when
        const result = isValidDateStr(input);
        // then
        expect(result).toBe(false);
      },
    );

    it.each([["2026-02-30"], ["2026-04-31"]])(
      "returns false for a day beyond the end of its month (%s)",
      (input) => {
        // given: a day that exists in some months but not in this one
        // when
        const result = isValidDateStr(input);
        // then
        expect(result).toBe(false);
      },
    );
  });

  describe("leap years", () => {
    it("returns true for February 29 in a leap year", () => {
      // given
      const input = "2028-02-29";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(true);
    });

    it("returns false for February 29 in a non-leap year", () => {
      // given
      const input = "2026-02-29";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns false for February 29 in a century year not divisible by 400", () => {
      // given
      const input = "1900-02-29";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(false);
    });

    it("returns true for February 29 in a century year divisible by 400", () => {
      // given
      const input = "2000-02-29";
      // when
      const result = isValidDateStr(input);
      // then
      expect(result).toBe(true);
    });
  });
});


// Contract for addDays(dateStr, daysToAdd) — decided 2026-10-18:
// - returns a NEW date string `YYYY-MM-DD`; works on calendar dates only, so the result never depends on the machine's timezone or daylight saving
// - daysToAdd may be positive, zero or negative, but must be an integer
// - an invalid dateStr (per isValidDateStr) or a non-integer daysToAdd throws a RangeError — a transformation must not silently pass bad data along

describe("addDays", () => {
  describe("moving forward", () => {
    it("adds one day within a month", () => {
      // given
      const dateStr = "2026-10-17";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-10-18");
    });

    it("returns the same date when adding zero days", () => {
      // given
      const dateStr = "2026-10-17";
      const daysToAdd = 0;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-10-17");
    });

    it("rolls over to the next month at the end of a month", () => {
      // given
      const dateStr = "2026-10-31";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-11-01");
    });

    it("rolls over to the next year on December 31", () => {
      // given
      const dateStr = "2026-12-31";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2027-01-01");
    });

    it("adds a larger number of days across a month boundary", () => {
      // given
      const dateStr = "2026-10-17";
      const daysToAdd = 30;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-11-16");
    });

    it("lands on the same day next year after 365 days in a non-leap span", () => {
      // given
      const dateStr = "2026-10-17";
      const daysToAdd = 365;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2027-10-17");
    });

    it("needs 366 days for a full year when the span contains a leap day", () => {
      // given
      const dateStr = "2027-10-17";
      const daysToAdd = 366;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2028-10-17");
    });
  });

  describe("leap years", () => {
    it("goes from February 28 to February 29 in a leap year", () => {
      // given
      const dateStr = "2028-02-28";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2028-02-29");
    });

    it("goes from February 29 to March 1 in a leap year", () => {
      // given
      const dateStr = "2028-02-29";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2028-03-01");
    });

    it("skips straight from February 28 to March 1 in a non-leap year", () => {
      // given
      const dateStr = "2026-02-28";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-03-01");
    });
  });

  describe("moving backward", () => {
    it("goes back to the last day of the previous month", () => {
      // given
      const dateStr = "2026-03-01";
      const daysToAdd = -1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-02-28");
    });

    it("goes back to December 31 of the previous year", () => {
      // given
      const dateStr = "2027-01-01";
      const daysToAdd = -1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-12-31");
    });
  });

  describe("year boundaries in realistic range", () => {
    it("crosses from 1900 to 1901 at year end", () => {
      // given
      const dateStr = "1900-12-31";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("1901-01-01");
    });

    it("crosses from 2099 to 2100 at year end", () => {
      // given
      const dateStr = "2099-12-31";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2100-01-01");
    });
  });

  describe("independence from timezone and daylight saving", () => {
    it("adds one day across the European spring clock change", () => {
      // given
      const dateStr = "2026-03-29";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-03-30");
    });

    it("adds one day across the European autumn clock change", () => {
      // given
      const dateStr = "2026-10-25";
      const daysToAdd = 1;
      // when
      const result = addDays(dateStr, daysToAdd);
      // then
      expect(result).toBe("2026-10-26");
    });
  });

  describe("invalid input", () => {
    it.each([["2026-02-30"], ["not-a-date"], [""], [null], [20261017]])(
      "throws a RangeError for the invalid date %p",
      (dateStr) => {
        // given: an input that isValidDateStr would reject
        const daysToAdd = 1;
        // when
        const call = () => addDays(dateStr, daysToAdd);
        // then
        expect(call).toThrow(RangeError);
      },
    );

    it.each([[1.5], [NaN], [Infinity], ["3"], [null], [undefined]])(
      "throws a RangeError when daysToAdd is %p",
      (daysToAdd) => {
        // given: a valid date but a daysToAdd that is not an integer
        const dateStr = "2026-10-17";
        // when
        const call = () => addDays(dateStr, daysToAdd);
        // then
        expect(call).toThrow(RangeError);
      },
    );
  });
});

// Contract for daysBetween(dateStr1, dateStr2) — decided 2026-10-18:
// - returns an integer number of days between the two dates, positive if dateStr2 is later than dateStr1, negative if earlier, and zero if they are the same date
// - an invalid dateStr (per isValidDateStr) throws a RangeError — a transformation must not silently pass bad data along

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    // given
    const dateStr1 = "2026-10-17";
    const dateStr2 = "2026-10-17";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(0);
  });

  it("returns a positive number of days when the second date is later", () => {
    // given
    const dateStr1 = "2026-10-17";
    const dateStr2 = "2026-10-20";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(3);
  });

  it("returns a negative number of days when the second date is earlier", () => {
    // given
    const dateStr1 = "2026-10-20";
    const dateStr2 = "2026-10-17";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(-3);
  });

  it("returns the correct number of days across a month boundary", () => {
    // given
    const dateStr1 = "2026-10-31";
    const dateStr2 = "2026-11-02";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(2);
  });

  it("returns the correct number of days across a year boundary", () => {
    // given
    const dateStr1 = "2026-12-31";
    const dateStr2 = "2027-01-02";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(2);
  });

  it("returns the correct number of days across a leap year boundary", () => {
    // given
    const dateStr1 = "2027-02-28";
    const dateStr2 = "2028-03-01";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(367);
  });

  it("counts whole days across the European spring clock change", () => {
    // given: the day the European clocks go forward (23-hour day)
    const dateStr1 = "2026-03-28";
    const dateStr2 = "2026-03-30";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(2);
  });

  it("counts whole days across the European autumn clock change", () => {
    // given: the day the European clocks go back (25-hour day)
    const dateStr1 = "2026-10-24";
    const dateStr2 = "2026-10-26";
    // when
    const result = daysBetween(dateStr1, dateStr2);
    // then
    expect(result).toBe(2);
  });

  it("throws a RangeError for an invalid first date string", () => {
    // given
    const dateStr1 = "not-a-date";
    const dateStr2 = "2026-10-17";
    // when
    const call = () => daysBetween(dateStr1, dateStr2);
    // then
    expect(call).toThrow(RangeError);
  });

  it("throws a RangeError for an invalid second date string", () => {
    // given
    const dateStr1 = "2026-10-17";
    const dateStr2 = "not-a-date";
    // when
    const call = () => daysBetween(dateStr1, dateStr2);
    // then
    expect(call).toThrow(RangeError);
  });

});


// Contract for isValidTimeZone(name) — decided 2026-10-18:
// - returns true only for a real IANA timezone name (e.g. "Europe/Berlin", "UTC")
// - returns false for anything else: unknown names, empty string, non-strings
// - never throws, whatever the input — callers use it as a yes/no question

describe("isValidTimeZone", () => {
  describe("real timezone names", () => {
    it.each([
      ["UTC"],
      ["Europe/Berlin"],
      ["Pacific/Auckland"],
      ["America/Los_Angeles"],
    ])("returns true for %s", (name) => {
      // given: a real IANA timezone name from the table above
      // when
      const result = isValidTimeZone(name);
      // then
      expect(result).toBe(true);
    });
  });

  describe("names that are not timezones", () => {
    it.each([["Mars/Phobos"], ["Europe/Atlantis"], ["not a timezone"]])(
      "returns false for the unknown name %s",
      (name) => {
        // given: a string that looks plausible but is not an IANA timezone
        // when
        const result = isValidTimeZone(name);
        // then
        expect(result).toBe(false);
      },
    );

    it("returns false for an empty string", () => {
      // given
      const name = "";
      // when
      const result = isValidTimeZone(name);
      // then
      expect(result).toBe(false);
    });
  });

  describe("non-string input", () => {
    it.each([[null], [undefined], [42], [{}]])(
      "returns false for %s without throwing",
      (name) => {
        // given: a value that is not a string
        // when
        const call = () => isValidTimeZone(name);
        // then
        expect(call).not.toThrow();
        expect(call()).toBe(false);
      },
    );
  });
});

// Contract for todayInZone(now, timeZone) — decided 2026-10-18:
// - `now` is a Date passed in; the function never reads the clock itself
// - returns the calendar date `YYYY-MM-DD` of that instant in the given timezone
// - an invalid timeZone (per isValidTimeZone) or a `now` that is not a valid Date throws a RangeError
// - it does NOT fall back to UTC: callers that want a fallback do it themselves (service layer)

describe("todayInZone", () => {
  it("returns the correct date in a timezone that is in UTC", () => {
    // given
    const now = new Date("2026-10-17T12:00:00Z"); // UTC noon
    const timeZone = "UTC";
    // when
    const result = todayInZone(now, timeZone);
    // then
    expect(result).toBe("2026-10-17");
  });

  it("returns the correct date in a timezone that is ahead of UTC", () => {
    // given
    const now = new Date("2026-10-17T12:00:00Z"); // UTC noon
    const timeZone = "Europe/Berlin"; // UTC+2 in October (CEST)
    // when
    const result = todayInZone(now, timeZone);
    // then
    expect(result).toBe("2026-10-17");
  });

  describe("same instant, different timezones", () => {
    it.each([
      ["UTC", "2026-10-17"],
      ["Pacific/Pago_Pago", "2026-10-17"],
      ["Pacific/Auckland", "2026-10-18"],
      ["Pacific/Kiritimati", "2026-10-18"],
    ])("at 2026-10-17T23:30Z the date in %s is %s", (timeZone, expected) => {
      // given: one instant, seen from zones UTC-11 up to UTC+14
      const now = new Date("2026-10-17T23:30:00Z");
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe(expected);
    });

    it("returns the previous day in a timezone behind UTC", () => {
      // given: 03:00 UTC is still the evening before in Los Angeles
      const now = new Date("2026-10-18T03:00:00Z");
      const timeZone = "America/Los_Angeles";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe("2026-10-17");
    });
  });

  describe("local midnight", () => {
    it("returns the new day exactly at local midnight", () => {
      // given: 22:00 UTC is 00:00 in Berlin (UTC+2) on the 18th
      const now = new Date("2026-10-17T22:00:00Z");
      const timeZone = "Europe/Berlin";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe("2026-10-18");
    });

    it("returns the old day one second before local midnight", () => {
      // given
      const now = new Date("2026-10-17T21:59:59Z");
      const timeZone = "Europe/Berlin";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe("2026-10-17");
    });
  });

  describe("daylight saving change", () => {
    it("still returns the 25th shortly after midnight on the autumn clock change", () => {
      // given: 2026-10-25 is the 25-hour day in Berlin; 00:30Z is 02:30 CEST
      const now = new Date("2026-10-25T00:30:00Z");
      const timeZone = "Europe/Berlin";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe("2026-10-25");
    });

    it("returns the 26th once the 25-hour day has ended", () => {
      // given: 23:30Z is 00:30 CET on the 26th (the offset is now UTC+1)
      const now = new Date("2026-10-25T23:30:00Z");
      const timeZone = "Europe/Berlin";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(result).toBe("2026-10-26");
    });
  });

  describe("result format", () => {
    it("always returns a valid date string", () => {
      // given
      const now = new Date("2026-01-05T08:00:00Z");
      const timeZone = "Asia/Tokyo";
      // when
      const result = todayInZone(now, timeZone);
      // then
      expect(isValidDateStr(result)).toBe(true);
    });
  });

  describe("invalid input", () => {
    it.each([["Mars/Phobos"], [""], [null], [undefined], [42]])(
      "throws a RangeError for the invalid timezone %s",
      (timeZone) => {
        // given: a valid instant but a timezone that isValidTimeZone rejects
        const now = new Date("2026-10-17T12:00:00Z");
        // when
        const call = () => todayInZone(now, timeZone);
        // then
        expect(call).toThrow(RangeError);
      },
    );

    it.each([[null], [undefined], ["2026-10-17"], [1760702400000], [new Date("garbage")]])(
      "throws a RangeError when now is %s",
      (now) => {
        // given: a valid timezone but a `now` that is not a valid Date
        const timeZone = "UTC";
        // when
        const call = () => todayInZone(now, timeZone);
        // then
        expect(call).toThrow(RangeError);
      },
    );
  });
});
