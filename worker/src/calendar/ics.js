import { isValidDateStr } from "../time/dates.js";

const TEXT_ESCAPES = {
  "\\": "\\\\",
  ";": "\\;",
  ",": "\\,",
  "\r\n": "\\n",
  "\r": "\\n",
  "\n": "\\n",
};

export function escapeText(text) {
  if (typeof text !== "string") {
    throw new RangeError("text must be a string");
  }
  return text.replace(/\\|;|,|\r\n|\r|\n/g, (match) => TEXT_ESCAPES[match]);
}

export function formatDate(dateStr) {
  if (!isValidDateStr(dateStr)) {
    throw new RangeError("dateStr must be a valid YYYY-MM-DD string");
  }
  return dateStr.replaceAll("-", "");
}

export function formatTimestampUtc(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("now must be a valid Date");
  }
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const MAX_LINE_OCTETS = 75;
const textEncoder = new TextEncoder();

export function foldLine(line) {
  const physicalLines = [];
  let current = "";
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;

  for (const character of line) {
    const characterOctets = textEncoder.encode(character).length;
    if (currentOctets + characterOctets > limit) {
      physicalLines.push(current);
      current = "";
      currentOctets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += character;
    currentOctets += characterOctets;
  }
  physicalLines.push(current);

  return physicalLines.join("\r\n ");
}

export function serializeEvent(event, now) {
  if (event === null || typeof event !== "object") {
    throw new RangeError("event must be an object");
  }
  if (typeof event.uid !== "string" || event.uid === "") {
    throw new RangeError("event.uid must be a non-empty string");
  }

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatTimestampUtc(now)}`,
    `DTSTART;VALUE=DATE:${formatDate(event.date)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    "END:VEVENT",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

const PRODID = "-//watchpapa//Calendar feed//EN";

export function serializeCalendar(events, now) {
  if (!Array.isArray(events)) {
    throw new RangeError("events must be an array");
  }

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
  ];
  const body = events.map((event) => serializeEvent(event, now)).join("");

  return header.map(foldLine).join("\r\n") + "\r\n" + body + "END:VCALENDAR\r\n";
}
