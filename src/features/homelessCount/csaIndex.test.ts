import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadCsaIndexOnce,
  parseCsaIndexPayload,
  resetCsaIndexCacheForTests,
  stripCsaPrefix,
} from "./csaIndex";


const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const SAMPLE_PAYLOAD = [
  { CSA_Label: "Los Angeles - Venice", Total_Pop: 2053 },
  { CSA_Label: "City of Long Beach", Total_Pop: 1873 },
  { CSA_Label: "Unincorporated - Angeles National Forest", Total_Pop: 0 },
];

describe("parseCsaIndexPayload", () => {
  it("returns an empty list for anything that is not an array", () => {
    expect(parseCsaIndexPayload(null)).toEqual([]);
    expect(parseCsaIndexPayload("x")).toEqual([]);
    expect(parseCsaIndexPayload({})).toEqual([]);
  });

  it("drops rows with a blank label or a non-finite count, and keeps the valid ones", () => {
    const rows = parseCsaIndexPayload([
      { CSA_Label: "Los Angeles - Venice", Total_Pop: 2053 },
      { CSA_Label: "   ", Total_Pop: 12 },
      { CSA_Label: "City of Azusa", Total_Pop: Number.NaN },
      { CSA_Label: "City of Azusa", Total_Pop: "271" },
      null,
    ]);

    expect(rows).toEqual([
      {
        CSA_Label: "Los Angeles - Venice",
        Total_Pop: 2053,
        displayName: "Venice",
        group: "losAngeles",
      },
    ]);
  });
});

describe("stripCsaPrefix", () => {
  it("splits the three label families", () => {
    expect(stripCsaPrefix("Los Angeles - Venice")).toEqual({
      group: "losAngeles",
      displayName: "Venice",
    });
    expect(stripCsaPrefix("City of Long Beach")).toEqual({ group: "cities", displayName: "Long Beach" });
    expect(stripCsaPrefix("Unincorporated - Altadena")).toEqual({
      group: "unincorporated",
      displayName: "Altadena",
    });
  });

  it("keeps an unrecognised label visible rather than dropping it", () => {
    expect(stripCsaPrefix("Catalina Island")).toEqual({ group: "cities", displayName: "Catalina Island" });
  });
});

describe("loadCsaIndexOnce", () => {
  beforeEach(() => {
    resetCsaIndexCacheForTests();
    fetchMock.mockReset();
    // A fresh Response per call — a shared one can only be read once.
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(SAMPLE_PAYLOAD))));
  });

  it("fetches the index once no matter how many callers mount", async () => {
    const [first, second] = await Promise.all([loadCsaIndexOnce(), loadCsaIndexOnce()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(3);
    expect(second).toBe(first);
  });

  it("re-fetches after the cache is reset", async () => {
    await loadCsaIndexOnce();
    resetCsaIndexCacheForTests();
    await loadCsaIndexOnce();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the memo on failure so a retry actually retries", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(loadCsaIndexOnce()).rejects.toThrow("offline");
    await expect(loadCsaIndexOnce()).resolves.toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
