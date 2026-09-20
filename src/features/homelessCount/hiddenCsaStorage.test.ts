import { beforeEach, describe, expect, it } from "vitest";

import { readHiddenCsaLabels, writeHiddenCsaLabels } from "./hiddenCsaStorage";

// Mirrors the module's own (unexported) key — kept in sync manually since there is nothing to
// import it from.
const HIDDEN_CSA_STORAGE_KEY = "citywise:homelessCountHidden";

describe("hiddenCsaStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a hidden set through storage", () => {
    writeHiddenCsaLabels(new Set(["Los Angeles - Venice", "City of Azusa"]));

    expect(readHiddenCsaLabels()).toEqual(new Set(["Los Angeles - Venice", "City of Azusa"]));
  });

  it("returns null when the key is absent", () => {
    expect(readHiddenCsaLabels()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(HIDDEN_CSA_STORAGE_KEY, "{not json");

    expect(readHiddenCsaLabels()).toBeNull();
  });

  it("returns null when the parsed value is not an array", () => {
    localStorage.setItem(HIDDEN_CSA_STORAGE_KEY, JSON.stringify({ not: "an array" }));

    expect(readHiddenCsaLabels()).toBeNull();
  });

  it("returns an empty set (not null) for a stored empty array — a real 'show everything' choice", () => {
    localStorage.setItem(HIDDEN_CSA_STORAGE_KEY, JSON.stringify([]));

    expect(readHiddenCsaLabels()).toEqual(new Set());
  });

  it("drops non-string entries but keeps the valid ones", () => {
    localStorage.setItem(
      HIDDEN_CSA_STORAGE_KEY,
      JSON.stringify(["Los Angeles - Venice", 42, null, { label: "nope" }]),
    );

    expect(readHiddenCsaLabels()).toEqual(new Set(["Los Angeles - Venice"]));
  });
});
