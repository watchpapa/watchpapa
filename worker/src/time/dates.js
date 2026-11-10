// Splits a `YYYY-MM-DD` string into [year, month, day] as numbers.
// Only call it with a string that is known to match that shape.
function parseDateStr(dateStr) {
  return dateStr.split("-").map(Number);
}

// Number of days in a month; `month` is 1-12.
// Example: daysInMonth(2028, 2) returns 29.
// How it works:
// - the Date constructor counts months from 0 (0 = January, 11 = December)
// - so passing `month` as it is (2 for February) makes JavaScript read it as the NEXT month (March)
// - day 0 of a month is the day before its 1st, so it is the last day of the month before it
// - that is the month we asked for: day 0 of March 2028 is 29 February 2028, so the answer is 29
// - for December, 12 rolls over to January of the next year, and its day 0 is 31 December
function daysInMonth(year, month) {
  const dayBeforeTheFirst = 0;
  return new Date(year, month, dayBeforeTheFirst).getDate();
}

export function isValidDateStr(dateStr) {
  // Check if the input is a string
  if (typeof dateStr !== "string") {
    return false;
  }
  // Check if the input matches the YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  const [year, month, day] = parseDateStr(dateStr);

  // Check if the month is valid (1-12)
  if (month < 1 || month > 12) {
    return false;
  }

  // Check if the day is valid for the given month and year
  if (day < 1 || day > daysInMonth(year, month)) {
    return false;
  }

  return true;
}

export function addDays(dateStr, daysToAdd) {
  if (!isValidDateStr(dateStr)) {
    throw new RangeError("Invalid date string");
  }

  if (!Number.isInteger(daysToAdd)) {
    throw new RangeError("daysToAdd must be an integer");
  }

  const [year, month, day] = parseDateStr(dateStr);
  const utcTime = Date.UTC(year, month - 1, day + daysToAdd);

  const resultDate = new Date(utcTime);
  const resultYear = resultDate.getUTCFullYear();
  const resultMonth = String(resultDate.getUTCMonth() + 1);
  const resultDay = resultDate.getUTCDate();

  const paddedMonth = resultMonth.padStart(2, "0");
  const paddedDay = String(resultDay).padStart(2, "0");

  return `${resultYear}-${paddedMonth}-${paddedDay}`;
}

export function daysBetween(dateStr1, dateStr2) {
  if (!isValidDateStr(dateStr1) || !isValidDateStr(dateStr2)) {
    throw new RangeError("Invalid date string");
  }

  const [year1, month1, day1] = parseDateStr(dateStr1);
  const [year2, month2, day2] = parseDateStr(dateStr2);

  const utcTime1 = Date.UTC(year1, month1 - 1, day1);
  const utcTime2 = Date.UTC(year2, month2 - 1, day2);

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const differenceInMilliseconds = utcTime2 - utcTime1;

  return differenceInMilliseconds / millisecondsPerDay;
}

export function isValidTimeZone(name) {
  if (typeof name !== "string") {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

export function todayInZone(now, timeZone) {
  if (!(now instanceof Date) || isNaN(now)) {
    throw new RangeError("Invalid date");
  }
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("Invalid time zone");
  }

  const options = {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const formatter = new Intl.DateTimeFormat("en-CA", options);
  const parts = formatter.formatToParts(now);

  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  const day = parts.find((part) => part.type === "day").value;

  return `${year}-${month}-${day}`;
}
