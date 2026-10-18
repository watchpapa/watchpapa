import { describe, it, expect } from "vitest";
import { isValidDateStr, addDays } from "../src/time/dates.js";



// Contract decided format: 2026-10-18: a valid date string is
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
    // These only prove something when the suite is run under different TZ
    // values (e.g. TZ=Europe/Berlin, TZ=America/Los_Angeles): a local-time
    // implementation can land on the wrong day around a clock change.
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
