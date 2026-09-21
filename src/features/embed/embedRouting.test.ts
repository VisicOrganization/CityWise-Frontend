import { describe, expect, it } from "vitest";

import { isKnownDistrict, parseDistrictId } from "./embedRouting";

describe("parseDistrictId", () => {
  it.each([
    ["cd2", 2],
    ["cd15", 15],
    ["CD2", 2],
    ["  cd2  ", 2],
    ["district-6", 6],
  ])("parses %s -> %i", (slug, expected) => {
    expect(parseDistrictId(slug)).toBe(expected);
  });

  it.each([undefined, "", "cd", "not-a-district"])("returns null for %s", (slug) => {
    expect(parseDistrictId(slug)).toBeNull();
  });
});

describe("isKnownDistrict", () => {
  it("is true for district 2, which the registry has data for", () => {
    expect(isKnownDistrict(2)).toBe(true);
  });

  it("is false for a syntactically valid but unregistered district id", () => {
    expect(isKnownDistrict(99)).toBe(false);
  });

  it("is false for null (unparseable slug)", () => {
    expect(isKnownDistrict(null)).toBe(false);
  });
});
