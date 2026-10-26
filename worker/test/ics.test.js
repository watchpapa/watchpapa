import { describe, it, expect } from "vitest";
import { escapeText, formatDate, formatTimestampUtc, foldLine, serializeEvent, serializeCalendar } from "../src/calendar/ics.js";

// Contract for the ICS serializer (RFC 5545) — decided 2026-10-25:
// - every line ends with CRLF
// - a line is at most 75 octets (UTF-8 bytes); longer lines are folded by inserting CRLF + one space
// - a multi-byte character is never split across two lines
// - TEXT values escape backslash, semicolon, comma and newline
// - all-day events use DTSTART;VALUE=DATE:YYYYMMDD
// - the serializer is pure: `now` is passed in, so the same input always gives the same bytes, whatever the machine's timezone
// - invalid input throws a RangeError

const octets = (text) => new TextEncoder().encode(text).length;
const unfold = (text) => text.replace(/\r\n /g, "");

describe("escapeText with plain text", () => {
  it("leaves plain text unchanged", () => {
    // given
    const text = "Game of Thrones S1E1";
    // when
    const result = escapeText(text);
    // then
    expect(result).toBe("Game of Thrones S1E1");
  });

  it("leaves an empty string empty", () => {
    // given
    const text = "";
    // when
    const result = escapeText(text);
    // then
    expect(result).toBe("");
  });
});

describe("escapeText with special characters", () => {
  it.each([
    ["a backslash", "a\\b", "a\\\\b"],
    ["a semicolon", "a;b", "a\\;b"],
    ["a comma", "a,b", "a\\,b"],
    ["a newline", "a\nb", "a\\nb"],
    ["a Windows newline", "a\r\nb", "a\\nb"],
  ])("escapes %s", (_name, text, expected) => {
    // given: text containing one special character
    // when
    const result = escapeText(text);
    // then
    expect(result).toBe(expected);
  });

  it("escapes the backslash itself before the characters that add one", () => {
    // given: a backslash followed by a semicolon
    const text = "\\;";
    // when
    const result = escapeText(text);
    // then: the backslash becomes two, the semicolon gets its own backslash
    expect(result).toBe("\\\\\\;");
  });

  it("escapes every special character in one text", () => {
    // given
    const text = "Dune, Part Two; Final\nCut";
    // when
    const result = escapeText(text);
    // then
    expect(result).toBe("Dune\\, Part Two\\; Final\\nCut");
  });

  it.each([[null], [undefined], [42]])(
    "throws a RangeError when the text is %o",
    (text) => {
      // given: a value that is not a string
      // when
      const call = () => escapeText(text);
      // then
      expect(call).toThrow(RangeError);
    },
  );
});

describe("formatDate", () => {
  it.each([
    ["2026-11-05", "20261105"],
    ["2028-02-29", "20280229"],
  ])("turns %s into %s", (dateStr, expected) => {
    // given: a valid date string
    // when
    const result = formatDate(dateStr);
    // then
    expect(result).toBe(expected);
  });

  it.each([["not-a-date"], ["2026-02-30"], [null], [20261105]])(
    "throws a RangeError for the invalid date %o",
    (dateStr) => {
      // given: something isValidDateStr rejects
      // when
      const call = () => formatDate(dateStr);
      // then
      expect(call).toThrow(RangeError);
    },
  );
});

describe("formatTimestampUtc", () => {
  it("formats an instant as a UTC timestamp", () => {
    // given
    const now = new Date("2026-10-25T12:34:56Z");
    // when
    const result = formatTimestampUtc(now);
    // then
    expect(result).toBe("20261025T123456Z");
  });

  it("zero-pads single-digit parts", () => {
    // given
    const now = new Date("2026-01-02T03:04:05Z");
    // when
    const result = formatTimestampUtc(now);
    // then
    expect(result).toBe("20260102T030405Z");
  });

  it("drops the milliseconds", () => {
    // given
    const now = new Date("2026-10-25T12:34:56.789Z");
    // when
    const result = formatTimestampUtc(now);
    // then
    expect(result).toBe("20261025T123456Z");
  });

  it.each([[new Date("garbage")], [null], ["2026-10-25T12:34:56Z"], [1761395696000]])(
    "throws a RangeError when now is %o",
    (now) => {
      // given: not a valid Date object
      // when
      const call = () => formatTimestampUtc(now);
      // then
      expect(call).toThrow(RangeError);
    },
  );
});

describe("foldLine with lines that fit", () => {
  it("leaves a short line unchanged", () => {
    // given
    const line = "SUMMARY:Short";
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe("SUMMARY:Short");
  });

  it("leaves an empty line empty", () => {
    // given
    const line = "";
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe("");
  });

  it("leaves a line of exactly 75 octets unchanged", () => {
    // given
    const line = "a".repeat(75);
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe(line);
  });
});

describe("foldLine with long ASCII lines", () => {
  it("folds a line of 76 octets after the 75th", () => {
    // given
    const line = "a".repeat(76);
    // when
    const result = foldLine(line);
    // then: CRLF plus one space starts the continuation line
    expect(result).toBe("a".repeat(75) + "\r\n " + "a");
  });

  it("fills continuation lines up to 75 octets including the leading space", () => {
    // given: 75 + 74 fit in two lines, one more needs a third
    const line = "a".repeat(150);
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe("a".repeat(75) + "\r\n " + "a".repeat(74) + "\r\n " + "a");
  });

  it("keeps every physical line within 75 octets", () => {
    // given
    const line = "x".repeat(500);
    // when
    const physicalLines = foldLine(line).split("\r\n");
    // then
    for (const physicalLine of physicalLines) {
      expect(octets(physicalLine)).toBeLessThanOrEqual(75);
    }
  });

  it("gives back the original line when unfolded", () => {
    // given
    const line = "SUMMARY:" + "word ".repeat(100);
    // when
    const result = unfold(foldLine(line));
    // then
    expect(result).toBe(line);
  });
});

describe("foldLine with multi-byte characters", () => {
  it("moves a 2-byte character to the next line instead of splitting it", () => {
    // given: 74 octets plus "ł" (2 octets) would be 76
    const line = "a".repeat(74) + "ł";
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe("a".repeat(74) + "\r\n " + "ł");
  });

  it("moves a 4-byte emoji to the next line instead of splitting it", () => {
    // given: 72 octets plus an emoji (4 octets) would be 76
    const line = "a".repeat(72) + "😀";
    // when
    const result = foldLine(line);
    // then
    expect(result).toBe("a".repeat(72) + "\r\n " + "😀");
  });

  it("keeps every line within 75 octets for text made only of emoji", () => {
    // given
    const line = "😀".repeat(100);
    // when
    const physicalLines = foldLine(line).split("\r\n");
    // then
    for (const physicalLine of physicalLines) {
      expect(octets(physicalLine)).toBeLessThanOrEqual(75);
    }
  });

  it("gives back the original multi-byte line when unfolded", () => {
    // given
    const line = "SUMMARY:" + "Zażółć gęślą jaźń 😀 ".repeat(20);
    // when
    const result = unfold(foldLine(line));
    // then
    expect(result).toBe(line);
  });
});

const now = new Date("2026-10-25T12:00:00Z");
const episode = {
  uid: "show-1399-s1e1@watchpapa",
  summary: "Game of Thrones S1E1",
  date: "2026-11-05",
};

describe("serializeEvent", () => {
  it("writes a complete all-day event with CRLF line endings", () => {
    // given
    // when
    const result = serializeEvent(episode, now);
    // then
    expect(result).toBe(
      "BEGIN:VEVENT\r\n" +
        "UID:show-1399-s1e1@watchpapa\r\n" +
        "DTSTAMP:20261025T120000Z\r\n" +
        "DTSTART;VALUE=DATE:20261105\r\n" +
        "SUMMARY:Game of Thrones S1E1\r\n" +
        "END:VEVENT\r\n",
    );
  });
});

describe("serializeEvent with special characters and long text", () => {
  it("escapes the summary", () => {
    // given
    const event = { ...episode, summary: "Dune, Part Two; Final\nCut" };
    // when
    const result = serializeEvent(event, now);
    // then
    expect(result).toContain("SUMMARY:Dune\\, Part Two\\; Final\\nCut\r\n");
  });

  it("folds a long summary and keeps every line within 75 octets", () => {
    // given
    const event = { ...episode, summary: "x".repeat(200) };
    // when
    const result = serializeEvent(event, now);
    // then
    expect(unfold(result)).toContain("SUMMARY:" + "x".repeat(200) + "\r\n");
    for (const physicalLine of result.split("\r\n")) {
      expect(octets(physicalLine)).toBeLessThanOrEqual(75);
    }
  });
});

describe("serializeEvent invalid input", () => {
  it.each([[""], [null], [undefined], [42]])(
    "throws a RangeError for the uid %o",
    (uid) => {
      // given
      const event = { ...episode, uid };
      // when
      const call = () => serializeEvent(event, now);
      // then
      expect(call).toThrow(RangeError);
    },
  );

  it.each([[null], [undefined], [42]])(
    "throws a RangeError for the summary %o",
    (summary) => {
      // given
      const event = { ...episode, summary };
      // when
      const call = () => serializeEvent(event, now);
      // then
      expect(call).toThrow(RangeError);
    },
  );

  it.each([["not-a-date"], ["2026-02-30"], [null], [20261105]])(
    "throws a RangeError for the date %o",
    (date) => {
      // given
      const event = { ...episode, date };
      // when
      const call = () => serializeEvent(event, now);
      // then
      expect(call).toThrow(RangeError);
    },
  );

  it("throws a RangeError for an invalid now", () => {
    // given
    const invalidNow = new Date("garbage");
    // when
    const call = () => serializeEvent(episode, invalidNow);
    // then
    expect(call).toThrow(RangeError);
  });

  it.each([[null], [undefined], ["event"]])(
    "throws a RangeError when the event is %o",
    (event) => {
      // given: not an event object
      // when
      const call = () => serializeEvent(event, now);
      // then
      expect(call).toThrow(RangeError);
    },
  );
});

const movie = {
  uid: "movie-693134@watchpapa",
  summary: "Dune: Part Two",
  date: "2026-11-20",
};

describe("serializeCalendar", () => {
  it("writes a valid empty calendar when there are no events", () => {
    // given
    const events = [];
    // when
    const result = serializeCalendar(events, now);
    // then
    expect(result).toBe(
      "BEGIN:VCALENDAR\r\n" +
        "VERSION:2.0\r\n" +
        "PRODID:-//watchpapa//Calendar feed//EN\r\n" +
        "CALSCALE:GREGORIAN\r\n" +
        "END:VCALENDAR\r\n",
    );
  });

  it("wraps the events between the calendar header and footer", () => {
    // given
    const events = [episode, movie];
    // when
    const result = serializeCalendar(events, now);
    // then
    expect(result.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(result.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
    expect(result).toContain(serializeEvent(episode, now));
    expect(result).toContain(serializeEvent(movie, now));
  });

  it("keeps the events in the order they were given", () => {
    // given
    const events = [movie, episode];
    // when
    const result = serializeCalendar(events, now);
    // then
    expect(result.indexOf("movie-693134")).toBeLessThan(
      result.indexOf("show-1399-s1e1"),
    );
  });

  it.each([[null], [undefined], ["events"], [{}]])(
    "throws a RangeError when events is %o instead of an array",
    (events) => {
      // given
      // when
      const call = () => serializeCalendar(events, now);
      // then
      expect(call).toThrow(RangeError);
    },
  );

  it("throws a RangeError when one of the events is invalid", () => {
    // given
    const events = [episode, { ...movie, date: "not-a-date" }];
    // when
    const call = () => serializeCalendar(events, now);
    // then
    expect(call).toThrow(RangeError);
  });
});

describe("serializeCalendar output quality", () => {
  const events = [
    episode,
    movie,
    { uid: "movie-1@watchpapa", summary: "Zażółć, gęślą; jaźń 😀\n".repeat(8), date: "2026-12-24" },
  ];

  it("uses CRLF for every line break and never a bare newline", () => {
    // given
    // when
    const result = serializeCalendar(events, now);
    // then
    expect(result.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("keeps every physical line within 75 octets", () => {
    // given
    // when
    const result = serializeCalendar(events, now);
    // then
    for (const physicalLine of result.split("\r\n")) {
      expect(octets(physicalLine)).toBeLessThanOrEqual(75);
    }
  });

  it("gives byte-identical output for the same input", () => {
    // given
    // when
    const first = serializeCalendar(events, now);
    const second = serializeCalendar(events, now);
    // then
    expect(second).toBe(first);
  });

  it("can be read back by an independent parser", () => {
    // given: a small reader written for this test, separate from the code under test
    const unescape = (value) =>
      value.replace(/\\([\\;,nN])/g, (_m, c) => (c === "n" || c === "N" ? "\n" : c));
    const readSummaries = (text) =>
      unfold(text)
        .split("\r\n")
        .filter((line) => line.startsWith("SUMMARY:"))
        .map((line) => unescape(line.slice("SUMMARY:".length)));
    // when
    const result = readSummaries(serializeCalendar(events, now));
    // then
    expect(result).toEqual(events.map((event) => event.summary));
  });
});
