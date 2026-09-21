import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { NeighborhoodCollection } from "../map/cd2Assets";
import { polygonBounds } from "./neighborhoodBounds";

const SHIPPED = path.join(process.cwd(), "public", "data", "cd2-neighborhoods.geojson");
const neighborhoods = JSON.parse(readFileSync(SHIPPED, "utf8")) as NeighborhoodCollection;

describe("polygonBounds", () => {
  /**
   * The regression this exists for: North Hollywood is a MultiPolygon in the shipped file, and
   * walking its coordinates as Polygon rings yields NaN, which MapLibre renders as nothing.
   */
  it("returns finite bounds for every neighborhood in the shipped file", () => {
    for (const feature of neighborhoods.features) {
      const bounds = polygonBounds(feature);
      expect(bounds, `${feature.properties.CSA_Label} produced no bounds`).not.toBeNull();
      for (const value of bounds!.flat()) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("covers the MultiPolygon case, not just the Polygon one", () => {
    const multi = neighborhoods.features.filter((f) => f.geometry.type === "MultiPolygon");
    expect(multi.length).toBeGreaterThan(0);
    for (const feature of multi) {
      const bounds = polygonBounds(feature)!;
      expect(bounds[0][0]).toBeLessThan(bounds[1][0]);
      expect(bounds[0][1]).toBeLessThan(bounds[1][1]);
    }
  });

  it("puts every neighborhood inside the Los Angeles area, not at 0,0", () => {
    for (const feature of neighborhoods.features) {
      const [[west, south], [east, north]] = polygonBounds(feature)!;
      expect(west).toBeGreaterThan(-119);
      expect(east).toBeLessThan(-118);
      expect(south).toBeGreaterThan(33.5);
      expect(north).toBeLessThan(34.5);
    }
  });

  it("returns null rather than a degenerate box when coordinates are unusable", () => {
    const broken = {
      type: "Feature" as const,
      properties: { CSA_Label: "broken" },
      geometry: { type: "Polygon" as const, coordinates: [[[NaN, NaN]]] },
    };
    expect(polygonBounds(broken)).toBeNull();
  });
});
