import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CSA_GROUP_ORDER,
  filterCsaRows,
  groupCsaRows,
  loadCsaIndexOnce,
  parseCsaIndexPayload,
  resetCsaIndexCacheForTests,
  stripCsaPrefix,
  type CsaRow,
} from "./csaIndex";


const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const SAMPLE_PAYLOAD = [
  { CSA_Label: "Los Angeles - Venice", Total_Pop: 2053 },
  { CSA_Label: "City of Long Beach", Total_Pop: 1873 },
  { CSA_Label: "Unincorporated - Angeles National Forest", Total_Pop: 0 },
];

function rowsFrom(labels: string[]): CsaRow[] {
  return parseCsaIndexPayload(labels.map((label) => ({ CSA_Label: label, Total_Pop: 1 })));
}


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

describe("groupCsaRows", () => {
  it("returns the three groups in fixed order, each sorted by display name", () => {
    const groups = groupCsaRows(
      rowsFrom([
        "Los Angeles - Venice",
        "Unincorporated - Altadena",
        "City of Whittier",
        "City of Azusa",
        "Los Angeles - Boyle Heights",
      ]),
    );

    expect(groups.map((group) => group.key)).toEqual(CSA_GROUP_ORDER);
    expect(groups.map((group) => group.rows.map((row) => row.displayName))).toEqual([
      ["Boyle Heights", "Venice"],
      ["Azusa", "Whittier"],
      ["Altadena"],
    ]);
  });
});

describe("filterCsaRows", () => {
  const rows = rowsFrom([
    "Los Angeles - Venice",
    "City of Azusa",
    "Unincorporated - Altadena",
  ]);

  it("matches the stripped display name", () => {
    expect(filterCsaRows(rows, "ven").map((row) => row.CSA_Label)).toEqual(["Los Angeles - Venice"]);
  });

  it("matches the raw label so the family prefix is searchable", () => {
    expect(filterCsaRows(rows, "unincorp").map((row) => row.CSA_Label)).toEqual([
      "Unincorporated - Altadena",
    ]);
  });

  it("returns everything for an empty query", () => {
    expect(filterCsaRows(rows, "")).toHaveLength(3);
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
