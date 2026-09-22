import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildMonthOptions,
  encampmentClusterLayer,
  encampmentPointLayer,
  filterReportsByMonth,
  reportsAtClickedPoint,
  type EncampmentCollection,
} from "./encampmentLayers";

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

  it("lists a report once even when MapLibre hits it in two tiles' buffers", () => {
    const here = [-118.370633, 34.144452];
    const twice = hit(encampmentPointLayer.id, here, "2026-02-01T10:00:00.000");
    expect(reportsAtClickedPoint([twice, { ...twice }])).toHaveLength(1);
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

describe("month filter helpers", () => {
  function collectionOf(...created: string[]): EncampmentCollection {
    return {
      type: "FeatureCollection",
      features: created.map((value) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [-118.37, 34.14] },
        properties: { created: value },
      })),
    };
  }

  it("lists only months that have reports, oldest first, with counts", () => {
    const collection = collectionOf(
      "2026-03-09T15:02:15.000",
      "2026-01-01T09:19:55.000",
      "2026-03-31T23:59:00.000",
    );
    expect(buildMonthOptions(collection)).toEqual([
      { key: "2026-01", label: "Jan", count: 1 },
      { key: "2026-03", label: "Mar", count: 2 },
    ]);
    expect(buildMonthOptions(null)).toEqual([]);
  });

  it("drops reports filed in hidden months, and passes the collection through when none are hidden", () => {
    const collection = collectionOf("2026-01-05T10:00:00.000", "2026-02-05T10:00:00.000");
    expect(filterReportsByMonth(collection, new Set())).toBe(collection);
    expect(
      filterReportsByMonth(collection, new Set(["2026-01"])).features.map((f) => f.properties.created),
    ).toEqual(["2026-02-05T10:00:00.000"]);
  });
});
