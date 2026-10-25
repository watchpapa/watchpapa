import { describe } from "vitest";
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

describe.todo("ICS serializer");
