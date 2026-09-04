const MONTH_MAP = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// Converts iOS-style date strings ("15 Jan 2024", "15 Jan. 2024", "Jan 15 2024")
// to the YYYY-MM-DD format expected by the database. Returns the original value
// unchanged if it's already ISO or can't be recognized.
export function normalizeDateInput(value) {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // Strip trailing periods from month abbreviations: "Jan." → "Jan"
  const s = value.replace(/([A-Za-z])\.(\s)/g, "$1$2").replace(/([A-Za-z])\.$/, "$1").trim();

  // "DD Mon YYYY" or "DD Month YYYY"
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (dmy) {
    const month = MONTH_MAP[dmy[2].toLowerCase().slice(0, 3)];
    if (month) return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
  }

  // "Mon DD YYYY" or "Month DD YYYY"
  const mdy = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(s);
  if (mdy) {
    const month = MONTH_MAP[mdy[1].toLowerCase().slice(0, 3)];
    if (month) return `${mdy[3]}-${month}-${mdy[2].padStart(2, "0")}`;
  }

  return value;
}

export function validateUsername(value) {
  if (!value || typeof value !== "string") return "Username is required.";
  if (value.length < 4) return "Username must be at least 4 characters.";
  if (value.length > 50) return "Username must be at most 50 characters.";
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    return "Username may only contain letters, numbers, underscores, and hyphens.";
  return null;
}

export function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

export function isValidBoolean(val) {
  return typeof val === "boolean";
}

export function validateMinAge(dateOfBirth, minYears = 16) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - minYears);
  return dob <= cutoff;
}

export function isValidLocale(value) {
  return typeof value === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(value);
}

export function isValidCountry(value) {
  return value === null || (typeof value === "string" && /^[A-Z]{2}$/.test(value));
}

export function isValidTitleMode(value) {
  return value === "translated" || value === "native_original";
}

export function isValidRegionList(value) {
  return Array.isArray(value) && value.length <= 5 && value.every((v) => /^[A-Z]{2}$/.test(v));
}

export function isValidProviderIds(value) {
  return Array.isArray(value) && value.length <= 50 && value.every((v) => Number.isInteger(v) && v > 0);
}
