import { describe, expect, it } from "vitest";

import {
  ASSET_POINTS_LAYER_ID,
  assetPointLayer,
  ASSET_PIN_IMAGE_IDS,
  assetPointBackingLayer,
  buildAssetHoverLayer,
  buildAssetSelectionFilter,
  buildCategoryFilter,
  buildSelectedAssetBackingLayer,
  buildSelectedAssetGlowLayer,
  buildSelectedAssetLayer,
  categoryIconExpression,
  ICON_RENDER_PX,
  buildNeighborhoodFilter,
  NEIGHBORHOOD_FILL_LAYER_ID,
  neighborhoodOutlineLayer,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  categoryColorExpression,
  neighborhoodFillLayer,
} from "./neighborhoodMapLayers";

describe("category encoding", () => {
  // The build script rejects any category outside these four, so the colour map and the label
  // map must both be total over them or a pin renders grey / unlabelled in the legend.
  it("assigns a colour and a label to every category in the fixed order", () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(CATEGORY_ORDER.length);
  });

  it("uses four distinct colours", () => {
    const colors = CATEGORY_ORDER.map((category) => CATEGORY_COLORS[category]);
    expect(new Set(colors).size).toBe(colors.length);
  });

  // Pins the palette read off the supplied pin artwork. These four do NOT clear the all-pairs
  // CVD floor the previous set did -- safety and district projects sit at dE2000 2.1 under
  // tritanopia -- which is survivable only because every pin and every legend key now carries a
  // distinct glyph. If this assertion fails, check the glyphs are still there before updating it.
  it("pins the palette taken from the pin artwork", () => {
    expect(CATEGORY_ORDER.map((category) => CATEGORY_COLORS[category])).toEqual([
      "#069DAA",
      "#06AA6B",
      "#E8644D",
      "#F364EC",
    ]);
  });

  it("builds a match expression with a fallback for an unknown category", () => {
    const expression = categoryColorExpression as unknown as unknown[];
    expect(expression[0]).toBe("match");
    // ["match", ["get", ...], k1, c1, k2, c2, k3, c3, k4, c4, fallback]
    expect(expression).toHaveLength(2 + CATEGORY_ORDER.length * 2 + 1);
    expect(expression.at(-1)).toBe("#6b7280");
  });
});

describe("buildCategoryFilter", () => {
  it("keeps only the active categories", () => {
    expect(buildCategoryFilter(["PUBLIC SAFETY"])).toEqual([
      "in",
      ["get", "category"],
      ["literal", ["PUBLIC SAFETY"]],
    ]);
  });

  it("does not alias the caller's array into the expression", () => {
    const active = ["PUBLIC SAFETY"];
    const filter = buildCategoryFilter(active) as unknown as [string, unknown, [string, string[]]];
    active.push("RECREATION & PARKS");
    expect(filter[2][1]).toEqual(["PUBLIC SAFETY"]);
  });
});

describe("layer specs", () => {
  it("exposes the point layer id the click handler filters on", () => {
    expect(assetPointLayer.id).toBe(ASSET_POINTS_LAYER_ID);
  });

  // Reusing csaFillLayer here would paint neighbourhoods by homeless density. This asserts the
  // fill is a flat colour, not a data-driven expression.
  it("fills neighbourhoods with a neutral flat colour, not a ramp", () => {
    expect(typeof neighborhoodFillLayer.paint?.["fill-color"]).toBe("string");
  });

  // The supplied SVGs are full-bleed circles with no outer ring, so the separation the palette's
  // sub-3:1 contrast needs comes from this layer instead of from a circle-stroke.
  //
  // This caught a real bug once: ICON_RENDER_PX was set to the 132px raster halved (33) rather
  // than the 66px the pixelRatio-2 registration actually yields, which made the disc NARROWER
  // than the icon it was meant to back -- invisible, doing nothing. Compare against the icon's
  // real drawn width, never against a constant repeated here.
  it("backs every pin with a white disc wider than the icon", () => {
    expect(assetPointBackingLayer.paint?.["circle-color"]).toBe("#ffffff");
    const [, discFar, , discNear] = numbersIn(assetPointBackingLayer.paint?.["circle-radius"]);
    expect(discFar * 2).toBeGreaterThan(iconWidthPx(assetPointLayer)[0]);
    expect(discNear * 2).toBeGreaterThan(iconWidthPx(assetPointLayer)[1]);
  });

  /**
   * Pins the pixels the pins actually occupy, at both stops.
   *
   * The regression this guards is not "someone changed a number" -- it is that icon-size is a
   * multiple of a size set three files away, in `assetPinImages.ts`, by the pixelRatio passed to
   * addImage. Nothing else in the codebase fails if those two disagree; the pins just silently
   * render at the wrong size. 40px is the council-file pin width on /map.
   */
  it("draws pins at the same ~40px footprint as the /map council-file pins", () => {
    const [farPx, nearPx] = iconWidthPx(assetPointLayer);
    expect(farPx).toBeCloseTo(22, 1);
    expect(nearPx).toBeCloseTo(40, 1);
  });

  it("derives icon-size from the registered image size, not a repeated literal", () => {
    // 66 is the SVG viewBox, which is what pixelRatio 2 on a 132px raster yields.
    expect(ICON_RENDER_PX).toBe(66);
    const [, farScale, , nearScale] = numbersIn(assetPointLayer.layout?.["icon-size"]);
    expect(farScale * ICON_RENDER_PX).toBeCloseTo(22, 1);
    expect(nearScale * ICON_RENDER_PX).toBeCloseTo(40, 1);
  });

  // A symbol layer, not a circle layer: the pins carry artwork now. Collision must stay off or
  // MapLibre silently hides pins in the dense parts of the district.
  it("draws pins as icons that are never hidden by collision", () => {
    expect(assetPointLayer.type).toBe("symbol");
    expect(assetPointLayer.layout?.["icon-image"]).toEqual(categoryIconExpression);
    expect(assetPointLayer.layout?.["icon-allow-overlap"]).toBe(true);
    expect(assetPointLayer.layout?.["icon-ignore-placement"]).toBe(true);
  });

  /**
   * Pins the weaker-than-colour fallback so it is a decision rather than an accident. Unlike
   * categoryColorExpression's grey, an unmatched category is drawn as a REAL category here, so
   * the thing actually protecting this is the build script's CATEGORY_KEYS guard plus the
   * four-map coupling asserted below.
   */
  it("falls back to the first category's icon for an unknown category", () => {
    const expression = categoryIconExpression as unknown as unknown[];
    expect(expression[0]).toBe("match");
    expect(expression).toHaveLength(2 + CATEGORY_ORDER.length * 2 + 1);
    expect(expression.at(-1)).toBe(ASSET_PIN_IMAGE_IDS[CATEGORY_ORDER[0]]);
  });

  // Adding a category to one map and not the others is what makes the fallback above reachable.
  it("keeps the label, colour and icon maps total over CATEGORY_ORDER", () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
      expect(CATEGORY_COLORS[category]).toBeTruthy();
      expect(ASSET_PIN_IMAGE_IDS[category]).toBeTruthy();
    }
  });

  it("maps every category to a registered icon id", () => {
    for (const category of CATEGORY_ORDER) {
      expect(ASSET_PIN_IMAGE_IDS[category]).toBeTruthy();
    }
    expect(new Set(Object.values(ASSET_PIN_IMAGE_IDS)).size).toBe(CATEGORY_ORDER.length);
  });
});

/** The numeric stops of an ["interpolate", ["linear"], ["zoom"], z, v, z, v] expression. */
function numbersIn(expression: unknown): number[] {
  return (expression as unknown[]).filter((value) => typeof value === "number") as number[];
}

/** An icon layer's drawn width in CSS pixels at the far and near zoom stops. */
function iconWidthPx(layer: { layout?: Record<string, unknown> }): [number, number] {
  const [, farScale, , nearScale] = numbersIn(layer.layout?.["icon-size"]);
  return [farScale * ICON_RENDER_PX, nearScale * ICON_RENDER_PX];
}

describe("buildNeighborhoodFilter", () => {
  it("matches one neighbourhood by its CSA label", () => {
    expect(buildNeighborhoodFilter("Los Angeles - Sun Valley")).toEqual([
      "==",
      ["get", "CSA_Label"],
      "Los Angeles - Sun Valley",
    ]);
  });

  // null must match nothing rather than everything: a filter that matched all of them would
  // paint every neighbourhood as hovered the moment the cursor left the map.
  it("matches nothing for null", () => {
    const filter = buildNeighborhoodFilter(null) as unknown as [string, unknown, string];
    expect(filter[2]).not.toBe("");
    expect(filter[2]).toContain("no-neighborhood");
  });
});

describe("buildAssetHoverLayer", () => {
  it("filters to the hovered pin and draws bigger than the base layer", () => {
    const hovered = {
      label: "Fire Station 60",
      category: "PUBLIC SAFETY",
      neighborhood: "Valley Village",
    };
    const hover = buildAssetHoverLayer(hovered);
    // Composite identity: two pins can share a label, and both used to light up together.
    expect(hover.filter).toEqual(buildAssetSelectionFilter(hovered));
    expect(hover.id).not.toBe(ASSET_POINTS_LAYER_ID);

    // The grow-on-hover effect is this layer's icon-size exceeding the base layer's at both
    // interpolation stops; if they ever matched, hovering would do nothing visible.
    const [baseZ10, baseS10, baseZ14, baseS14] = numbersIn(assetPointLayer.layout?.["icon-size"]);
    const [hoverZ10, hoverS10, hoverZ14, hoverS14] = numbersIn(hover.layout?.["icon-size"]);
    expect([hoverZ10, hoverZ14]).toEqual([baseZ10, baseZ14]);
    expect(hoverS10).toBeGreaterThan(baseS10);
    expect(hoverS14).toBeGreaterThan(baseS14);
  });

  it("matches nothing for null", () => {
    const filter = buildAssetHoverLayer(null).filter as unknown as [string, unknown, string];
    expect(filter[2]).toContain("no-asset");
  });
});

describe("neighbourhood boundaries are drawn to be seen", () => {
  // This layer began as a white hairline copied from csaLayers.ts, where its job was to go
  // unnoticed. Here the boundaries are the content, so a white or hairline value is a regression.
  it("uses a dark line, not the white hairline it started as", () => {
    expect(neighborhoodOutlineLayer.paint?.["line-color"]).not.toBe("#ffffff");
    const width = neighborhoodOutlineLayer.paint?.["line-width"] as unknown as unknown[];
    const stops = width.filter((value) => typeof value === "number") as number[];
    // [zoom9, width, zoom13, width] -- both widths must clear the 1.2px hairline.
    expect(stops[1]).toBeGreaterThan(1.2);
    expect(stops[3]).toBeGreaterThan(stops[1]);
  });

  it("exposes the fill layer id the hover and click handlers hit-test", () => {
    expect(NEIGHBORHOOD_FILL_LAYER_ID).toBe("cd2-neighborhood-fill");
  });
});

describe("selected asset layers", () => {
  const identity = {
    category: "RECREATION & PARKS",
    neighborhood: "Studio City",
    label: "South Weddington Park",
  };

  // Label alone would light up both South Weddington Parks, which are two different points.
  it("matches on category, neighborhood and label together", () => {
    expect(buildAssetSelectionFilter(identity)).toEqual([
      "all",
      ["==", ["get", "label"], "South Weddington Park"],
      ["==", ["get", "category"], "RECREATION & PARKS"],
      ["==", ["get", "neighborhood"], "Studio City"],
    ]);
  });

  it("matches nothing when there is no selection", () => {
    expect(buildAssetSelectionFilter(null)).toEqual([
      "==",
      ["get", "label"],
      "\u0000no-asset",
    ]);
  });

  // 1.5x the base icon-size at both interpolation stops, not a flat bump: the base grows with
  // zoom, and a constant addition would read as a different amount of emphasis per zoom.
  it("draws the selected pin at 1.5x the base icon size at every stop", () => {
    const [, baseFar, , baseNear] = numbersIn(assetPointLayer.layout?.["icon-size"]);
    const [, selFar, , selNear] = numbersIn(
      buildSelectedAssetLayer(identity).layout?.["icon-size"],
    );
    expect(selFar).toBeCloseTo(baseFar * 1.5);
    expect(selNear).toBeCloseTo(baseNear * 1.5);
  });

  it("keeps the pin's own artwork when selected rather than swapping the mark", () => {
    expect(buildSelectedAssetLayer(identity).layout?.["icon-image"]).toEqual(
      categoryIconExpression,
    );
  });

  // The glow is a blurred circle because the pins live in the WebGL canvas, where no CSS
  // shadow reaches them. It must sit wider than the pin it haloes, and stay translucent.
  it("draws a wider, blurred, translucent glow behind the selected pin", () => {
    const glow = buildSelectedAssetGlowLayer(identity).paint ?? {};
    const backing = buildSelectedAssetBackingLayer(identity).paint ?? {};
    expect(glow["circle-blur"]).toBeGreaterThan(0);
    expect(glow["circle-opacity"]).toBeLessThan(1);
    expect(numbersIn(glow["circle-radius"])[3]).toBeGreaterThan(
      numbersIn(backing["circle-radius"])[3],
    );
    expect(glow["circle-color"]).toEqual(categoryColorExpression);
  });

  it("gives every selection layer an id distinct from the base and hover layers", () => {
    const ids = [
      assetPointLayer.id,
      assetPointBackingLayer.id,
      buildAssetHoverLayer(identity).id,
      buildSelectedAssetGlowLayer(identity).id,
      buildSelectedAssetBackingLayer(identity).id,
      buildSelectedAssetLayer(identity).id,
    ];
    expect(new Set(ids).size).toBe(6);
  });
});
