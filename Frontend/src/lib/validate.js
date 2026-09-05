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

export function validateEmail(value) {
  const v = (value ?? "").trim();
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
  return null;
}

// The one password policy (register, reset). Returns per-rule booleans for the
// live checklist plus a single error message when something is missing.
export function getPasswordPolicyStatus(pw = "") {
  return {
    minLength: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

export const PASSWORD_RULES = [
  { key: "minLength", label: "At least 8 characters" },
  { key: "lower", label: "One lowercase letter" },
  { key: "upper", label: "One uppercase letter" },
  { key: "digit", label: "One digit" },
  { key: "symbol", label: "One symbol (!@#$% etc.)" },
];

export function validatePassword(pw) {
  if (!pw) return "Password is required.";
  const s = getPasswordPolicyStatus(pw);
  const missing = [];
  if (!s.minLength) missing.push("at least 8 characters");
  if (!s.lower) missing.push("a lowercase letter");
  if (!s.upper) missing.push("an uppercase letter");
  if (!s.digit) missing.push("a digit");
  if (!s.symbol) missing.push("a symbol");
  if (missing.length === 0) return null;
  const list = missing.length === 1 ? missing[0] : missing.length === 2 ? `${missing[0]} and ${missing[1]}` : `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`;
  return `Password must include ${list}.`;
}

// Age in whole years from an ISO date string, or null when unparsable.
export function ageFromDate(dateString) {
  if (!dateString) return null;
  const birth = new Date(dateString);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function isAdult(dateString) {
  const age = ageFromDate(dateString);
  return age != null && age >= 18;
}

// ISO date of the latest birthday that satisfies `minYears` (for <input max>).
export function maxDateOfBirth(minYears = 16) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minYears);
  return d.toISOString().slice(0, 10);
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
