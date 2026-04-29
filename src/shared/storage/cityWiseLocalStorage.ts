const CITYWISE_KEY_PREFIX = "citywise:";
const LAST_RESET_CALENDAR_DAY_KEY = "citywise:lastStorageResetCalendarDay";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

/** Local calendar day as YYYY-MM-DD (respects user timezone). */
export function formatLocalCalendarDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function collectCityWiseKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(CITYWISE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/** Removes API cache, landing drafts, and other CityWise keys. Does not touch third-party keys (e.g. analytics). */
export function clearAllCityWiseLocalStorage(storage?: Storage): void {
  const target = storage ?? getStorage();
  if (!target) {
    return;
  }
  for (const key of collectCityWiseKeys(target)) {
    target.removeItem(key);
  }
}

function stampResetDay(storage: Storage, calendarDay: string): void {
  storage.setItem(LAST_RESET_CALENDAR_DAY_KEY, calendarDay);
}

/**
 * If the browser has not run a CityWise reset for the current local calendar day yet, clears all `citywise:*` keys and records today.
 * Call once on app startup (before reading cached UX state).
 */
export function maintainCityWiseLocalStorageForNewDay(now: Date = new Date()): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const today = formatLocalCalendarDay(now);
  const last = storage.getItem(LAST_RESET_CALENDAR_DAY_KEY);
  if (last === today) {
    return;
  }

  clearAllCityWiseLocalStorage(storage);
  stampResetDay(storage, today);
}

/**
 * Clears CityWise local storage and stamps today. Use after sign-in when you want the same freshness as the daily reset without waiting until tomorrow.
 */
export function resetCityWiseLocalStorageAfterLogin(now: Date = new Date()): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  clearAllCityWiseLocalStorage(storage);
  stampResetDay(storage, formatLocalCalendarDay(now));
}
