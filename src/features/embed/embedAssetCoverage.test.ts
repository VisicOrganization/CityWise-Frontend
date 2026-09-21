import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { selectAllAssets, selectDistrictAssets, type AssetCollection } from "../map/cd2Assets";

const SHIPPED = path.join(process.cwd(), "public", "data", "cd2-civic-assets.geojson");
const assets = JSON.parse(readFileSync(SHIPPED, "utf8")) as AssetCollection;

/**
 * The district embed's list is the text equivalent of its map. The map draws every category, so
 * a selector that covered only one would leave most pins unlisted -- which is the accessibility
 * property the embed exists to preserve on a page that is currently plain accessible text.
 */
describe("district embed asset coverage", () => {
  it("lists every located asset the map draws", () => {
    expect(selectAllAssets(assets)).toHaveLength(assets.features.length);
  });

  it("covers strictly more than the Districtwide bucket that /map's district panel shows", () => {
    expect(selectAllAssets(assets).length).toBeGreaterThan(selectDistrictAssets(assets).length);
  });

  it("spans all four categories, not just district projects", () => {
    const categories = new Set(selectAllAssets(assets).map((a) => a.properties.category));
    expect(categories.size).toBe(4);
  });
});
