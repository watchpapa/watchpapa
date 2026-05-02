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
  return readCookie() === CONSENT.ACCEPTED;
}

export function hasMadeChoice() {
  return readCookie() !== null;
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
