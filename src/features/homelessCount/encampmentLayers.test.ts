import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { encampmentClusterLayer, encampmentPointLayer, reportsAtClickedPoint } from "./encampmentLayers";

function hit(layerId: string, coordinates: number[], created: string) {
  return {
    layer: { id: layerId },
    geometry: { type: "Point", coordinates },
    properties: { created, caseNumber: created },
  };
}

describe("reportsAtClickedPoint", () => {
  it("returns every report stacked at the topmost point, newest first", () => {
    const here = [-118.370633, 34.144452];
    const reports = reportsAtClickedPoint([
      hit(encampmentPointLayer.id, here, "2026-02-01T10:00:00.000"),
      hit(encampmentPointLayer.id, here, "2026-09-01T10:00:00.000"),
      hit(encampmentPointLayer.id, here, "2026-05-01T10:00:00.000"),
    ]);
    expect(reports.map((report) => report.created)).toEqual([
      "2026-09-01T10:00:00.000",
      "2026-05-01T10:00:00.000",
      "2026-02-01T10:00:00.000",
    ]);
  });

  it("leaves out a neighboring point whose circle merely overlaps the click", () => {
    const reports = reportsAtClickedPoint([
      hit(encampmentPointLayer.id, [-118.3706, 34.1444], "2026-02-01T10:00:00.000"),
      hit(encampmentPointLayer.id, [-118.3707, 34.1445], "2026-03-01T10:00:00.000"),
    ]);
    expect(reports).toHaveLength(1);
  });

  it("ignores features from other layers", () => {
    expect(
      reportsAtClickedPoint([hit(encampmentClusterLayer.id, [-118.37, 34.14], "2026-02-01T10:00:00.000")]),
    ).toEqual([]);
  });
});

describe("committed cd2-encampment-reports.geojson", () => {
  const collection = JSON.parse(
    readFileSync(join(process.cwd(), "public/data/cd2-encampment-reports.geojson"), "utf8"),
  ) as { features: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }[] };

  it("carries every field the popup renders, already normalized", () => {
    expect(collection.features).toHaveLength(4936);
    for (const { properties } of collection.features) {
      expect(typeof properties.caseNumber).toBe("string");
      expect(properties.address).not.toMatch(/LOS ANGELES|, CA\b/);
      expect(properties.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      // A close date equal to the intake time is dropped at build time, never shipped.
      expect(properties.closed).not.toBe(properties.created);
    }
  });
});
