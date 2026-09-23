import { createExpression, featureFilter, v8 } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import {
  buildSelectedCsaFilter,
  buildVisibleCsaFilter,
  csaFillColorExpression,
  csaFillLayer,
  csaHighlightLayer,
  csaOutlineLayer,
  DENSITY_LEGEND_STOPS,
} from "./csaLayers";

/** The real `fill-color` property spec (type "color", MapLibre's own documented `#000000`
 * default among other things) — reused here rather than hand-rolled, so `createExpression` below
 * type-checks and coerces string literals to `Color` exactly as MapLibre does at render time. */
const FILL_COLOR_SPEC = v8.paint_fill["fill-color"];

/** Evaluates `csaFillColorExpression` against fake tile-feature properties the same way MapLibre
 * would at render time, using the style-spec's own expression engine rather than re-implementing
 * `case`/`step`/`to-number` evaluation semantics by hand. */
function evaluateFillColor(properties: Record<string, unknown>): string {
  const { value } = createExpression(csaFillColorExpression, FILL_COLOR_SPEC);
  if (!value || typeof (value as { evaluate?: unknown }).evaluate !== "function") {
    throw new Error("csaFillColorExpression failed to parse");
  }
  const evaluated = (
    value as { evaluate: (ctx: { zoom: number }, feature: unknown) => { toString(): string } }
  ).evaluate({ zoom: 0 }, { type: "Feature", properties, geometry: null });
  return evaluated.toString();
}

/** `#rrggbb` -> the `rgba(r,g,b,1)` string MapLibre's `Color#toString()` produces, so a legend
 * hex value can be compared directly against `evaluateFillColor`'s output. */
function hexToRgbaString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},1)`;
}

/** Evaluates a `buildVisibleCsaFilter` result against fake tile-feature properties the same way
 * MapLibre would at render time. Returns `true` iff the feature would be rendered. */
function evaluateVisibleFilter(visibleLabels: string[], properties: Record<string, unknown>): boolean {
  const filter = featureFilter(buildVisibleCsaFilter(visibleLabels));
  return filter.filter({ zoom: 0 } as never, {
    type: "Feature",
    properties,
    geometry: null,
  } as never) as boolean;
}


describe("csaLayers", () => {
  it("colors by density with a dedicated true-zero class", () => {
    expect(csaFillLayer.paint?.["fill-color"]).toEqual(csaFillColorExpression);
    expect(csaFillColorExpression).toEqual([
      "case",
      ["==", ["to-number", ["get", "Total_Pop"], 0], 0],
      "#e8eaed",
      [
        "step",
        ["to-number", ["get", "Density_Total"], 0],
        "#c7e9c0",
        5,
        "#8ed18a",
        20,
        "#41ab5d",
        75,
        "#006d2c",
        200,
        "#00441b",
      ],
    ]);
  });

  it("colors a normal feature by its actual density, unaffected by the null-safety wrapper", () => {
    expect(evaluateFillColor({ Total_Pop: 500, Density_Total: 10 })).toBe(hexToRgbaString("#8ed18a"));
    expect(evaluateFillColor({ Total_Pop: 0, Density_Total: 0 })).toBe(hexToRgbaString("#e8eaed"));
  });

  it("never falls back to MapLibre's black default when Density_Total is missing", () => {
    // Regression test for the reported black-screen bug: a `step` expression throws on a
    // non-numeric input, and MapLibre silently repaints the whole layer with `fill-color`'s
    // style-spec default (#000000) when that happens. Verified live (2026-09-19): every feature
    // in the Scout `query` layer outside the 304 known CSAs is missing this attribute.
    const color = evaluateFillColor({ Total_Pop: 500 /* Density_Total absent */ });
    expect(color).not.toBe(hexToRgbaString("#000000"));
    expect(color).toBe(hexToRgbaString("#c7e9c0"));
  });

  it("keeps the legend swatches identical to the paint ramp", () => {
    // The only thing stopping the legend and the map from drifting apart.
    const [, , zeroColor, stepExpression] = csaFillColorExpression as unknown as [
      string,
      unknown,
      string,
      unknown[],
    ];
    const rampColors = [zeroColor, ...stepExpression.filter((token) => typeof token === "string" && token.startsWith("#"))];

    expect(DENSITY_LEGEND_STOPS.map((stop) => stop.color)).toEqual(rampColors);
  });

  it("holds fill opacity constant because the polygons are the content", () => {
    expect(csaFillLayer.paint?.["fill-opacity"]).toBe(0.72);
    expect(csaOutlineLayer.paint?.["line-color"]).toBe("#ffffff");
  });

  it("renders exactly the named neighborhoods, with the expression form of `in`", () => {
    expect(buildVisibleCsaFilter(["Los Angeles - Venice"])).toEqual([
      "all",
      ["==", ["typeof", ["get", "CSA_Label"]], "string"],
      ["in", ["get", "CSA_Label"], ["literal", ["Los Angeles - Venice"]]],
    ]);
    expect(evaluateVisibleFilter(["Los Angeles - Venice"], { CSA_Label: "Los Angeles - Venice" })).toBe(
      true,
    );
    expect(evaluateVisibleFilter(["Los Angeles - Venice"], { CSA_Label: "Los Angeles - Echo Park" })).toBe(
      false,
    );
  });

  it("hides a feature with a missing or non-string CSA_Label", () => {
    // Regression test for the reported bug: at every reachable zoom, the live Scout `query`
    // layer carries non-CSA administrative polygons (council districts, supervisorial districts,
    // service planning areas, incorporated cities, the county outline) with no `CSA_Label`
    // attribute at all. The old exclusion-only filter treated "not in the hidden list" as
    // "visible", so these rendered unconditionally — and, scoped to District 2, they rendered
    // right through the district filter too. Naming the keepers cannot fail that way.
    const cd2 = ["Los Angeles - Venice"];
    expect(evaluateVisibleFilter(cd2, {})).toBe(false);
    expect(evaluateVisibleFilter(cd2, { CSA_Label: null })).toBe(false);
    expect(evaluateVisibleFilter(cd2, { CSA_Label: 42 })).toBe(false);
  });

  it("highlights the selected border distinctly from the default white outline", () => {
    expect(csaHighlightLayer.paint?.["line-color"]).toBe("#f97316");
    expect(csaHighlightLayer.paint?.["line-color"]).not.toBe(csaOutlineLayer.paint?.["line-color"]);
    expect(csaHighlightLayer.paint?.["line-width"]).toBeGreaterThan(
      Number(csaOutlineLayer.paint?.["line-width"]),
    );
  });

  it("builds no filter when nothing is selected", () => {
    // The no-op case is `undefined`, and callers are expected not to render the highlight layer
    // at all rather than pass this through to MapLibre.
    expect(buildSelectedCsaFilter(null)).toBeUndefined();
  });

  it("filters the highlight layer down to exactly the selected label", () => {
    expect(buildSelectedCsaFilter("Los Angeles - Venice")).toEqual([
      "==",
      ["get", "CSA_Label"],
      "Los Angeles - Venice",
    ]);
  });
});
