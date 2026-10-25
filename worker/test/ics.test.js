import { describe } from "vitest";
import { escapeText, formatDate, formatTimestampUtc, foldLine, serializeEvent, serializeCalendar } from "../src/calendar/ics.js";

const octets = (text) => new TextEncoder().encode(text).length;
const unfold = (text) => text.replace(/\r\n /g, "");

describe.todo("ICS serializer");
