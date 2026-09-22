import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AssetCollection } from "../map/cd2Assets";
import { resolveResources } from "./resourceEngine";
import type { NeighborhoodIntent } from "./contracts";

const intent = (partial: Partial<NeighborhoodIntent>): NeighborhoodIntent => ({
  action: "find", resource_type: null, resource_name: null, neighborhood: null, field: null, ...partial,
});
const assets = (rows: Array<Record<string, unknown>>): AssetCollection => ({
  type: "FeatureCollection",
  features: rows.map((properties, index) => ({ type: "Feature", geometry: { type: "Point", coordinates: [-118.4 + index / 100, 34.18] }, properties: {
    label: `Resource ${index}`, category: "RECREATION & PARKS", neighborhood: "Studio City", precision: "rooftop", ...properties,
  } as never })),
});

describe("resolveResources", () => {
  it("covers the authoritative 68-record asset collection and reviewed tags", () => {
    const shipped = JSON.parse(readFileSync("public/data/cd2-civic-assets.geojson", "utf8")) as AssetCollection;
    expect(shipped.features).toHaveLength(68);
    const result = resolveResources(shipped, intent({ resource_type: "parks" }), null);
    expect(result.items.some((item) => item.properties.label === "Whitsett Ave Sports Complex")).toBe(true);
    expect(resolveResources(shipped, intent({ resource_type: "housing" }), null).items.some((item) => item.properties.label.includes("Homes4Famiilies"))).toBe(true);
  });

  it("matches shared serves values and explicit district parks", () => {
    const data = assets([
      { label: "Shared Police", category: "PUBLIC SAFETY", neighborhood: "Multiple neighborhoods", serves: "Studio City, Valley Glen" },
      { label: "Keswick Pocket Park", category: "DISTRICT PROJECTS & OFFICE", neighborhood: "Districtwide" },
    ]);
    expect(resolveResources(data, intent({ resource_type: "police", neighborhood: "Valley Glen" }), null).items).toHaveLength(1);
    expect(resolveResources(data, intent({ resource_type: "parks", resource_name: "Keswick" }), null).items).toHaveLength(1);
  });

  it("returns ambiguity and does not choose an arbitrary detail", () => {
    const data = assets([{ label: "South Weddington Park" }, { label: "South Weddington Park", neighborhood: "Toluca Lake" }]);
    expect(resolveResources(data, intent({ resource_name: "South Weddington Park" }), null).needs).toBe("resource");
    expect(resolveResources(data, intent({ action: "details" }), null).needs).toBe("resource");
  });

  it("requires a point for nearest and sorts the closest three", () => {
    const data = assets([{ label: "A" }, { label: "B" }, { label: "C" }, { label: "D" }]);
    const nearest = resolveResources(data, intent({ action: "nearest" }), { longitude: -118.4, latitude: 34.18 });
    expect(nearest.items).toHaveLength(3);
    expect(resolveResources(data, intent({ action: "nearest" }), null).needs).toBe("point");
  });

  it("rejects unknown neighborhoods and reports missing fields", () => {
    const data = assets([{ label: "Library", address: "1 Main" }]);
    expect(resolveResources(data, intent({ neighborhood: "Not A Neighborhood" }), null).items).toHaveLength(0);
    expect(resolveResources(data, intent({ resource_name: "Library", field: "phone" }), null).answer).toContain("does not record");
  });
});
