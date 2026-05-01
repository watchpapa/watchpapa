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
