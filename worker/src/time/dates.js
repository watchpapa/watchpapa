// Splits a `YYYY-MM-DD` string into [year, month, day] as numbers.
// Only call it with a string that is known to match that shape.
function parseDateStr(dateStr) {
  return dateStr.split("-").map(Number);
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
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
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
  } catch (error) {
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
