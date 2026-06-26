// =============================================================
// Monthly license gate
// -------------------------------------------------------------
// Each month has its own random-looking password. During the LAST
// 7 DAYS of a month, the app starts warning that the next month's
// password is needed. If the user enters it, warnings stop and the
// app keeps working into next month. If they fail to enter it by
// the time the month rolls over, the app locks automatically until
// the correct code for the new month is supplied.
//
// To rotate / add codes: edit MONTHLY_PASSWORDS below and redeploy.
// Keys are "YYYY-MM" (the month the code unlocks).
// =============================================================

export const MONTHLY_PASSWORDS: Record<string, string> = {
  "2026-06": "tRWQR3cK8po8F7i",
  "2026-07": "9aHm2NvP6tLqB4x",
  "2026-08": "kY7sD3wQ8jR2nXc",
  "2026-09": "M4pL9zVbN6tQ2fR",
  "2026-10": "X8gT3kW5jH7nP2q",
  "2026-11": "qZ6mB4yL2dC9vR8",
  "2026-12": "F3nP7kJ2xW9hM5t",
  "2027-01": "b8KqR2nT5wP4jH7",
  "2027-02": "D9vM3zL6yQ2pN4x",
  "2027-03": "h7T2kF8jB5wR3qM",
};

const STORAGE_KEY = "erp_license_unlocked_until"; // value: "YYYY-MM"
const WARN_DAYS = 7;

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function currentMonth(now: Date = new Date()): string {
  return ym(now);
}

export function nextMonth(now: Date = new Date()): string {
  const n = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return ym(n);
}

export function getUnlockedUntil(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Days remaining in the current month, not counting today. */
export function daysLeftInMonth(now: Date = new Date()): number {
  return lastDayOfMonth(now) - now.getDate();
}

/** True during the last WARN_DAYS days of a month, if the user has not
 *  yet unlocked the next month. The warning disappears the moment they
 *  enter the next month's password. */
export function needsRenewal(now: Date = new Date()): boolean {
  if (daysLeftInMonth(now) > WARN_DAYS - 1) return false;
  const until = getUnlockedUntil();
  return !until || until < nextMonth(now);
}

/** The month the user is being prompted for (warning or unlock screen). */
export function requiredMonth(now: Date = new Date()): string {
  return needsRenewal(now) ? nextMonth(now) : currentMonth(now);
}

/** Hard lock: the app refuses to run unless the CURRENT month is paid. */
export function isUnlocked(now: Date = new Date()): boolean {
  const until = getUnlockedUntil();
  if (!until) return false;
  return until >= currentMonth(now);
}

/** Try to unlock with the given password. Accepts the current month's
 *  code OR the next month's code (so users can pay early during the
 *  warning window). Returns true on success. */
export function tryUnlock(password: string, now: Date = new Date()): boolean {
  const pw = password.trim();
  const cur = currentMonth(now);
  const nxt = nextMonth(now);
  if (MONTHLY_PASSWORDS[nxt] && pw === MONTHLY_PASSWORDS[nxt]) {
    const prev = getUnlockedUntil();
    if (!prev || prev < nxt) localStorage.setItem(STORAGE_KEY, nxt);
    return true;
  }
  if (MONTHLY_PASSWORDS[cur] && pw === MONTHLY_PASSWORDS[cur]) {
    const prev = getUnlockedUntil();
    if (!prev || prev < cur) localStorage.setItem(STORAGE_KEY, cur);
    return true;
  }
  return false;
}

export function lockApp() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}