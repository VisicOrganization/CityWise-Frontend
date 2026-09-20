import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assetKey,
  getDistrictAssetSource,
  hasNeighborhoodMap,
  loadDistrictAssetsOnce,
  getPanelSourceUrl,
  resetCd2AssetCacheForTests,
  resolvePanelSelection,
  type NeighborhoodCollection,
} from "./cd2Assets";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  resetCd2AssetCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("district asset registry", () => {
  it("has data for district 2", () => {
    expect(hasNeighborhoodMap(2)).toBe(true);
    expect(getDistrictAssetSource(2)?.assets).toContain("cd2-civic-assets");
  });

  // The overview sheet is generic across 1-15; every other district must render no panel at
  // all rather than an empty map frame.
  it.each([1, 3, 7, 14, 15])("has no data for district %i", (districtId) => {
    expect(hasNeighborhoodMap(districtId)).toBe(false);
    expect(getDistrictAssetSource(districtId)).toBeNull();
  });

  it("opens on the same bounds the homeless-count CD2 preset uses", () => {
    expect(getDistrictAssetSource(2)?.bounds).toEqual([
      [-118.50268, 34.11904],
      [-118.26682, 34.25721],
    ]);
  });
});

describe("loadDistrictAssetsOnce", () => {
  it("fetches both files once and reuses the promise across callers", async () => {
    const fetchMock = vi.fn(async () => okResponse(EMPTY_COLLECTION));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      loadDistrictAssetsOnce(2),
      loadDistrictAssetsOnce(2),
    ]);

    expect(first).toBe(second);
    // Two files, not four: the memo covers the second caller.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects for a district with no registry entry instead of fetching", async () => {
    const fetchMock = vi.fn(async () => okResponse(EMPTY_COLLECTION));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadDistrictAssetsOnce(3)).rejects.toThrow(/district 3/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A transient failure must not poison the memo, or the panel stays broken until reload.
  it("clears the memo on failure so a retry refetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValue(okResponse(EMPTY_COLLECTION));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadDistrictAssetsOnce(2)).rejects.toThrow(/503/);
    await expect(loadDistrictAssetsOnce(2)).resolves.toMatchObject({
      assets: { type: "FeatureCollection" },
    });
  });

  it("rejects a payload that is not a FeatureCollection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse({ nope: true })));
    await expect(loadDistrictAssetsOnce(2)).rejects.toThrow(/FeatureCollection/);
  });
});

describe("useDistrictAssets enabled gate", () => {
  // The overlay is off by default on /map, so a session that never turns it on must not pay
  // for either file.
  it("fetches nothing while disabled", async () => {
    const fetchMock = vi.fn(async () => okResponse(EMPTY_COLLECTION));
    vi.stubGlobal("fetch", fetchMock);

    const { renderHook, waitFor } = await import("@testing-library/react");
    const { useDistrictAssets } = await import("./cd2Assets");

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDistrictAssets(2, enabled),
      { initialProps: { enabled: false } },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBeNull();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("resolvePanelSelection", () => {
  const park = { category: "RECREATION & PARKS", neighborhood: "Studio City", label: "Beeman" };
  const station = {
    category: "PUBLIC SAFETY",
    neighborhood: "Multiple neighborhoods",
    serves: "Valley Glen, Van Nuys",
    label: "Van Nuys Community Police Station",
  };

  it("sends a District projects & office pin to the district panel", () => {
    expect(
      resolvePanelSelection(
        { category: "DISTRICT PROJECTS & OFFICE", neighborhood: "Districtwide", label: "Median" },
        null,
      ),
    ).toEqual({ kind: "district" });
  });

  // Category decides, not `neighborhood`: this pin serves Valley Glen too, so a neighborhood
  // test would route it away from the panel that actually lists it under its own colour.
  it("routes a district-category pin that also serves a neighborhood to the district panel", () => {
    expect(
      resolvePanelSelection(
        {
          category: "DISTRICT PROJECTS & OFFICE",
          neighborhood: "Multiple neighborhoods",
          serves: "Districtwide, Valley Glen",
          label: "Tujunga Green Belt",
        },
        { kind: "neighborhood", csaLabel: "Los Angeles - Valley Glen" },
      ),
    ).toEqual({ kind: "district" });
  });

  it("opens the pin's own neighborhood when nothing is open", () => {
    expect(resolvePanelSelection(park, null)).toEqual({
      kind: "neighborhood",
      csaLabel: "Los Angeles - Studio City",
    });
  });

  // Clicking a station that serves four neighbourhoods should scroll the panel you are already
  // reading, not throw you into the first name in its `serves` list.
  it("keeps the open neighborhood panel when it already contains the pin", () => {
    const current = { kind: "neighborhood", csaLabel: "Los Angeles - Van Nuys" } as const;
    expect(resolvePanelSelection(station, current)).toBe(current);
  });

  it("switches to the first served neighborhood when the open panel cannot show the pin", () => {
    expect(
      resolvePanelSelection(station, { kind: "neighborhood", csaLabel: "Los Angeles - Studio City" }),
    ).toEqual({ kind: "neighborhood", csaLabel: "Los Angeles - Valley Glen" });
  });

  it("switches away from the district panel to a neighborhood pin's own panel", () => {
    expect(resolvePanelSelection(park, { kind: "district" })).toEqual({
      kind: "neighborhood",
      csaLabel: "Los Angeles - Studio City",
    });
  });

  // "Districtwide"/"Multiple neighborhoods" are pin groupings, not CSAs, so a pin left with only
  // those has no panel to open. The caller leaves whatever is open alone.
  it("returns null for a pin with no real neighborhood", () => {
    expect(
      resolvePanelSelection(
        { category: "PUBLIC SAFETY", neighborhood: "Multiple neighborhoods", label: "Orphan" },
        null,
      ),
    ).toBeNull();
  });
});

describe("assetKey", () => {
  // Label alone collides: "South Weddington Park" is two different points in the real data.
  it("distinguishes same-named pins in different neighborhoods", () => {
    const a = { category: "RECREATION & PARKS", neighborhood: "Studio City", label: "South Weddington Park" };
    const b = { category: "RECREATION & PARKS", neighborhood: "Toluca Lake", label: "South Weddington Park" };
    expect(assetKey(a)).not.toEqual(assetKey(b));
  });

  it("is stable for the same pin", () => {
    const pin = { category: "PUBLIC SAFETY", neighborhood: "Van Nuys", label: "Station" };
    expect(assetKey(pin)).toEqual(assetKey({ ...pin }));
  });

  it("tolerates a feature missing fields rather than throwing", () => {
    expect(assetKey({})).toEqual("||");
  });
});

describe("getPanelSourceUrl", () => {
  const neighborhoods = {
    type: "FeatureCollection",
    district_source_url: "https://cd2.lacity.gov/district-2",
    features: [
      {
        type: "Feature",
        properties: {
          CSA_Label: "Los Angeles - Studio City",
          source_url: "https://cd2.lacity.gov/district-2/studio-city",
        },
        geometry: { type: "Polygon", coordinates: [] },
      },
      {
        type: "Feature",
        properties: { CSA_Label: "Los Angeles - Van Nuys" },
        geometry: { type: "Polygon", coordinates: [] },
      },
    ],
  } as unknown as NeighborhoodCollection;

  it("reads a neighborhood's page off its CSA polygon", () => {
    expect(
      getPanelSourceUrl(neighborhoods, {
        kind: "neighborhood",
        csaLabel: "Los Angeles - Studio City",
      }),
    ).toBe("https://cd2.lacity.gov/district-2/studio-city");
  });

  // "Districtwide" is a pin grouping with no polygon, so the district's page rides on the
  // collection as a foreign member instead.
  it("reads the district's page off the collection", () => {
    expect(getPanelSourceUrl(neighborhoods, { kind: "district" })).toBe(
      "https://cd2.lacity.gov/district-2",
    );
  });

  it("returns null for a polygon the sheet left without a source_url", () => {
    expect(
      getPanelSourceUrl(neighborhoods, { kind: "neighborhood", csaLabel: "Los Angeles - Van Nuys" }),
    ).toBeNull();
  });

  it("returns null for a neighborhood that is not in the collection", () => {
    expect(
      getPanelSourceUrl(neighborhoods, { kind: "neighborhood", csaLabel: "Los Angeles - Nowhere" }),
    ).toBeNull();
  });

  // The value comes from a spreadsheet cell, so it is not trusted to be a safe href.
  it.each(["javascript:alert(1)", "data:text/html,x", "cd2.lacity.gov", "  "])(
    "refuses to link %s",
    (value) => {
      const collection = {
        type: "FeatureCollection",
        district_source_url: value,
        features: [],
      } as unknown as NeighborhoodCollection;
      expect(getPanelSourceUrl(collection, { kind: "district" })).toBeNull();
    },
  );
});
