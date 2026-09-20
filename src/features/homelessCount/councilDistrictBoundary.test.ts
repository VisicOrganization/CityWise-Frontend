import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadDistrictBoundaries, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import {
  COUNCIL_DISTRICTS_GEOJSON_PATH,
  districtBoundaryLineLayer,
  HOMELESS_COUNT_DISTRICT_ID,
  loadCouncilDistrictBoundaryOnce,
  resetCouncilDistrictBoundaryCacheForTests,
} from "./councilDistrictBoundary";
import { csaHighlightLayer, csaOutlineLayer } from "./csaLayers";

function districtFeature(id: number, name: string) {
  return {
    type: "Feature" as const,
    properties: {
      District: id,
      District_Name: `District ${id}`,
      NAME: name,
      NLA_URL: "",
      OBJECTID: id,
      TOOLTIP: name,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [-118.5 - id, 34.0],
          [-118.3 - id, 34.0],
          [-118.3 - id, 34.2],
          [-118.5 - id, 34.2],
          [-118.5 - id, 34.0],
        ],
      ],
    },
  };
}

/** Two districts, so "returns District 2" can't pass by returning whatever came first. */
const boundariesPayload: DistrictBoundaryCollection = {
  type: "FeatureCollection",
  features: [districtFeature(1, "Eunisses Hernandez"), districtFeature(2, "Adrin Nazarian")],
};

const fetchMock = vi.fn();

describe("councilDistrictBoundary", () => {
  beforeEach(() => {
    resetCouncilDistrictBoundaryCacheForTests();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(boundariesPayload))),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the exact file the shared loader requests", async () => {
    // The drift guard for `COUNCIL_DISTRICTS_GEOJSON_PATH`. `shared/map/districtBoundaries.ts`
    // keeps its path private and is out of scope to modify, so the left panel's "Data sources"
    // section can't import it — this test pins the literal to the real request instead. If that
    // loader's path ever moves, this fails rather than the provenance panel quietly naming a
    // file the app no longer reads.
    await loadDistrictBoundaries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe(COUNCIL_DISTRICTS_GEOJSON_PATH);
  });

  it("resolves District 2 only, not the whole 15-district collection", async () => {
    const feature = await loadCouncilDistrictBoundaryOnce();

    expect(feature?.properties.District).toBe(HOMELESS_COUNT_DISTRICT_ID);
    expect(feature?.properties.NAME).toBe("Adrin Nazarian");
  });

  it("fetches the 1.5 MB file at most once across repeated toggles", async () => {
    await loadCouncilDistrictBoundaryOnce();
    await loadCouncilDistrictBoundaryOnce();
    await loadCouncilDistrictBoundaryOnce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the memo after a failure so the next mount can retry", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("nope", { status: 500 })));

    await expect(loadCouncilDistrictBoundaryOnce()).rejects.toThrow();
    // A memo left holding the rejected promise would make the failure permanent for the session.
    await expect(loadCouncilDistrictBoundaryOnce()).resolves.toMatchObject({
      properties: { District: HOMELESS_COUNT_DISTRICT_ID },
    });
  });

  it("draws the boundary as a dashed line, distinct from the two line treatments already used", () => {
    // It sits on top of the choropleth: a fill layer would tint every density class under it.
    expect(districtBoundaryLineLayer.type).toBe("line");
    expect(districtBoundaryLineLayer.paint?.["line-dasharray"]).toBeDefined();
    // Neither the white CSA hairline nor the orange selection highlight — both already taken.
    expect(districtBoundaryLineLayer.paint?.["line-color"]).not.toBe(
      csaOutlineLayer.paint?.["line-color"],
    );
    expect(districtBoundaryLineLayer.paint?.["line-color"]).not.toBe(
      csaHighlightLayer.paint?.["line-color"],
    );
  });
});
