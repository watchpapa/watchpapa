const COOKIE_NAME = "cookie_consent";
const MAX_AGE = 365 * 24 * 60 * 60;

export const CONSENT = { ACCEPTED: "accepted", DECLINED: "declined" };

function readCookie() {
  return (
    document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split("=")[1] ?? null
  );
}

export function getConsentStatus() {
  return readCookie();
}

export function hasAccepted() {
  const cookie = readCookie();
  if (cookie !== null) return cookie === CONSENT.ACCEPTED;
  if (browserRequestsNoTracking()) return false;
  return false;
}

export function browserRequestsNoTracking() {
  return navigator.doNotTrack === "1" || navigator.doNotTrack === "yes";
}

export function hasMadeChoice() {
  const cookie = readCookie();
  if (cookie !== null) return true;
  if (browserRequestsNoTracking()) return true;
  return false;
}

function writeCookie(value) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${MAX_AGE}; path=/; SameSite=Strict${secure}`;
}

function migrateKeys(from, to) {
  const keys = [];
  for (let i = 0; i < from.length; i++) {
    const key = from.key(i);
    if (key?.startsWith("sb-")) keys.push(key);
  }
  for (const key of keys) {
    const value = from.getItem(key);
    if (value !== null) to.setItem(key, value);
    from.removeItem(key);
  }
}

export function acceptCookies() {
  writeCookie(CONSENT.ACCEPTED);
  migrateKeys(sessionStorage, localStorage);
}

export function declineCookies() {
  writeCookie(CONSENT.DECLINED);
  migrateKeys(localStorage, sessionStorage);
}
