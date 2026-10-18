import { describe, it, expect } from "vitest";
import { isValidDateStr } from "../src/time/dates.js";

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
