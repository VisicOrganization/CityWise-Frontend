import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAllCityWiseLocalStorage,
  formatLocalCalendarDay,
  maintainCityWiseLocalStorageForNewDay,
  resetCityWiseLocalStorageAfterLogin,
} from "./cityWiseLocalStorage";

describe("cityWiseLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("formatLocalCalendarDay uses local timezone components", () => {
    expect(formatLocalCalendarDay(new Date(Date.UTC(2026, 3, 28, 12, 0, 0)))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maintainCityWiseLocalStorageForNewDay clears citywise keys when calendar day advanced", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 27, 23, 0, 0));
    maintainCityWiseLocalStorageForNewDay();
    localStorage.setItem("citywise:api-cache:v1:districts", '{"data":{"items":[]}}');
    localStorage.setItem("citywise:landingAddressQuery", "123 Main");

    vi.setSystemTime(new Date(2026, 3, 28, 8, 0, 0));
    maintainCityWiseLocalStorageForNewDay();

    expect(localStorage.getItem("citywise:api-cache:v1:districts")).toBeNull();
    expect(localStorage.getItem("citywise:landingAddressQuery")).toBeNull();
    expect(localStorage.getItem("citywise:lastStorageResetCalendarDay")).toBe("2026-04-28");

    vi.useRealTimers();
  });

  it("maintainCityWiseLocalStorageForNewDay no-ops twice same day", () => {
    maintainCityWiseLocalStorageForNewDay(new Date(2026, 3, 28, 7, 0, 0));
    localStorage.setItem("citywise:api-cache:v1:districts", '{"data":{}}');

    maintainCityWiseLocalStorageForNewDay(new Date(2026, 3, 28, 18, 0, 0));

    expect(localStorage.getItem("citywise:api-cache:v1:districts")).toBe('{"data":{}}');
  });

  it("does not remove non-citywise keys", () => {
    localStorage.setItem("ph_fake", "x");
    localStorage.setItem("citywise:z", "1");

    maintainCityWiseLocalStorageForNewDay(new Date(2026, 4, 1, 6, 0, 0));

    expect(localStorage.getItem("ph_fake")).toBe("x");
    expect(localStorage.getItem("citywise:z")).toBeNull();
  });

  it("resetCityWiseLocalStorageAfterLogin clears and stamps today", () => {
    localStorage.setItem("citywise:landingAddressQuery", "old");
    resetCityWiseLocalStorageAfterLogin(new Date(2026, 5, 15, 10, 0, 0));

    expect(localStorage.getItem("citywise:landingAddressQuery")).toBeNull();
    expect(localStorage.getItem("citywise:lastStorageResetCalendarDay")).toBe("2026-06-15");
  });

  it("clearAllCityWiseLocalStorage removes only citywise keys", () => {
    localStorage.setItem("other", "a");
    localStorage.setItem("citywise:k", "v");
    clearAllCityWiseLocalStorage();

    expect(localStorage.getItem("other")).toBe("a");
    expect(localStorage.getItem("citywise:k")).toBeNull();
  });
});
