import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

/**
 * Layers for the district overview's Neighborhood Map.
 *
 * Deliberately NOT reusing `csaLayers.ts`: that file's fill is a homeless-density choropleth
 * (a blue sequential ramp keyed on `Density_Total`). Painting neighbourhoods with it here
 * would colour them by homelessness on a panel about parks and phone numbers. The polygons
 * are the same CSAs; the encoding is not.
 *
 * Pins are a circle layer rather than one React `<Marker>` each. `CityMap.tsx` uses Markers
 * because every project pin carries arbitrary React content and a hover card, which is also
 * why `useMapData` has to cap at 100 of them. These pins need a dot and a click.
 */

export const ASSET_POINTS_LAYER_ID = "cd2-asset-points";
export const NEIGHBORHOOD_FILL_LAYER_ID = "cd2-neighborhood-fill";

export const CATEGORY_LABELS: Record<string, string> = {
  "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES": "Neighborhood orgs & resources",
  "RECREATION & PARKS": "Recreation & parks",
  "PUBLIC SAFETY": "Public safety",
  "DISTRICT PROJECTS & OFFICE": "District projects & office",
};

/**
 * The four category hues, taken from the supplied pin artwork in `public/images/pins/` -- these
 * are read off the SVGs, not chosen here, so changing a pin file means changing its entry here.
 *
 * READ THIS BEFORE REMOVING A GLYPH. The previous palette was picked to survive colour-vision
 * deficiency as the *only* encoding, and measured ΔE2000 9.2 on the worst CVD pair against an
 * ≥8 target. This palette does not clear that bar: public safety (#E8644D) and district
 * projects (#F364EC) come out at ΔE 2.1 under tritanopia -- effectively the same colour.
 *
 * That is acceptable only because colour is no longer the encoding. Each pin now carries a
 * distinct white glyph, and the legend shows the same glyph rather than a colour dot, so hue is
 * redundant reinforcement. Go back to bare dots, or drop the glyph from the legend key, and
 * these four become ambiguous for a tritan viewer with nothing else to read them by.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES": "#069DAA",
  "RECREATION & PARKS": "#06AA6B",
  "PUBLIC SAFETY": "#E8644D",
  "DISTRICT PROJECTS & OFFICE": "#F364EC",
};

/**
 * The synthesized fourth category.
 *
 * NOT a category the city assigned: `build_cd2_assets.py` falls back to this string whenever a
 * row's `category` cell is blank, which in the current workbook is exactly the 18 `Level =
 * District` rows. It is therefore "district-level items the sheet never categorised" -- the
 * council office, medians, bike paths -- and is what routes a clicked pin to the District
 * Overview panel instead of a neighbourhood one.
 */
export const DISTRICT_PROJECTS_CATEGORY = "DISTRICT PROJECTS & OFFICE";

/** Order the legend renders in, and the fixed hue order above. Never cycled. */
export const CATEGORY_ORDER = [
  "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES",
  "RECREATION & PARKS",
  "PUBLIC SAFETY",
  "DISTRICT PROJECTS & OFFICE",
] as const;

/**
 * Category -> the icon id `assetPinImages.ts` registers with the style.
 *
 * Lives here rather than beside the file paths because it is a layer concern: these strings are
 * what `icon-image` resolves. Keeping it here also keeps the dependency one-way -- that module
 * imports this one for CATEGORY_ORDER, so this one must not import it back.
 */
export const ASSET_PIN_IMAGE_IDS: Record<string, string> = {
  "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES": "cd2-pin-orgs",
  "RECREATION & PARKS": "cd2-pin-parks",
  "PUBLIC SAFETY": "cd2-pin-safety",
  "DISTRICT PROJECTS & OFFICE": "cd2-pin-district",
};

/** Anything whose category is not one of the four; should never appear if the build ran. */
const FALLBACK_COLOR = "#6b7280";

export const categoryColorExpression = [
  "match",
  ["get", "category"],
  ...CATEGORY_ORDER.flatMap((key) => [key, CATEGORY_COLORS[key]]),
  FALLBACK_COLOR,
] as unknown as ExpressionSpecification;

/**
 * Neutral single tone, not a data ramp -- the fills say "these are the neighbourhoods", and
 * the pins on top are the content. Kept pale enough that a violet or blue pin reads clearly
 * against it, and light enough that the dashed district boundary stays legible over it.
 */
export const neighborhoodFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: NEIGHBORHOOD_FILL_LAYER_ID,
  type: "fill",
  paint: {
    "fill-color": "#c8d4e0",
    "fill-opacity": 0.3,
  },
};

/**
 * Hover highlight, filtered to one neighbourhood at a time.
 *
 * A fill rather than a line: the outline is already heavy (see below), so a heavier edge would
 * not read as a state change. Deliberately lighter than the selection fill so the two are
 * distinguishable when the cursor is over a neighbourhood other than the selected one.
 */
export const neighborhoodHoverFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "cd2-neighborhood-hover",
  type: "fill",
  paint: {
    "fill-color": "#1d865e",
    "fill-opacity": 0.16,
  },
};

/** Click selection. Same orange the rest of the app uses for "you picked this one". */
export const neighborhoodSelectedFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "cd2-neighborhood-selected",
  type: "fill",
  paint: {
    "fill-color": "#f97316",
    "fill-opacity": 0.22,
  },
};

/**
 * Neighbourhood edges, drawn to be seen.
 *
 * This started as a 0.8px white hairline copied from `csaLayers.ts`, where the job is to
 * separate two polygons of a choropleth without drawing attention. Here the boundaries ARE
 * content -- the whole point of the overlay is "these are the neighbourhoods" -- so it is a
 * dark slate line at 2px with a white casing underneath, which keeps it legible over both the
 * pale fill and the basemap's own road lines.
 */
export const neighborhoodOutlineCasingLayer: Omit<LineLayerSpecification, "source"> = {
  id: "cd2-neighborhood-outline-casing",
  type: "line",
  paint: {
    "line-color": "#ffffff",
    "line-width": 4,
    "line-opacity": 0.85,
  },
};

export const neighborhoodOutlineLayer: Omit<LineLayerSpecification, "source"> = {
  id: "cd2-neighborhood-outline",
  type: "line",
  paint: {
    "line-color": "#41556e",
    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.6, 13, 2.6] as unknown as
      ExpressionSpecification,
    "line-opacity": 0.95,
  },
};

/** Matches one neighbourhood by label, for the hover and selection fills. */
export function buildNeighborhoodFilter(label: string | null): ExpressionSpecification {
  return [
    "==",
    ["get", "CSA_Label"],
    label ?? "\u0000no-neighborhood",
  ] as unknown as ExpressionSpecification;
}

/**
 * Neighbourhood names, with the "Los Angeles - " prefix stripped in the expression rather than
 * in a rebuilt data file -- the generated GeoJSON keeps `CSA_Label` verbatim so it still joins
 * against `councilDistricts.ts`.
 *
 * Colour is the map's text ink, never a series colour: the pins carry identity here.
 */
export const neighborhoodLabelLayer: Omit<SymbolLayerSpecification, "source"> = {
  id: "cd2-neighborhood-label",
  type: "symbol",
  layout: {
    "text-field": [
      "coalesce",
      ["slice", ["get", "CSA_Label"], 14],
      ["get", "CSA_Label"],
    ] as unknown as ExpressionSpecification,
    "text-font": ["Open Sans Semibold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 9, 13, 12],
    "text-padding": 4,
    "text-max-width": 8,
  },
  paint: {
    "text-color": "#475569",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.2,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.75, 12, 1],
  },
};

/**
 * Resolves a pin's category to the icon id `assetPinImages.ts` registered for it.
 *
 * The fallback is the FIRST category's icon, which is weaker than `categoryColorExpression`'s:
 * that one falls back to a distinct grey so an unmatched category is visibly flagged, whereas an
 * unmatched category here is drawn as if it really were "Neighborhood orgs & resources". There is
 * no "unknown" artwork to point at, and naming an unregistered id is worse -- MapLibre warns
 * every frame and draws no pin at all, so the row would vanish silently.
 *
 * Unreachable from committed data: `build_cd2_assets.py` raises SystemExit on any category
 * outside CATEGORY_KEYS, which mirrors CATEGORY_ORDER. Adding a fifth category means updating
 * four places together -- CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS, ASSET_PIN_IMAGE_IDS
 * -- plus CATEGORY_KEYS in the build script. Miss ASSET_PIN_IMAGE_IDS and this fallback hides it.
 */
export const categoryIconExpression = [
  "match",
  ["get", "category"],
  ...CATEGORY_ORDER.flatMap((key) => [key, ASSET_PIN_IMAGE_IDS[key]]),
  ASSET_PIN_IMAGE_IDS[CATEGORY_ORDER[0]],
] as unknown as ExpressionSpecification;

/**
 * Icon scale by zoom. The artwork renders at 33 CSS px, so these are 18px at the panel's opening
 * framing and 33px zoomed in.
 *
 * Bigger than the 9-16px circles this replaced, because a glyph has to be legible where a dot
 * only had to be visible. That is a real density cost: ~68 pins share the district view, and at
 * 18px they touch in the dense parts of Studio City. Sizing down far enough to stop that makes
 * the glyph unreadable, which would forfeit the whole reason for the icons.
 */
/**
 * The artwork's own CSS-pixel size at `icon-size: 1`.
 *
 * `assetPinImages.ts` rasterises the 66px viewBox at 132px and registers it with
 * `pixelRatio: 2`, and MapLibre divides by that ratio -- so one icon-size unit is 66 CSS px,
 * the source viewBox, NOT the 132px raster. Getting this wrong makes every circle layer derived
 * from it half the width it should be.
 */
export const ICON_RENDER_PX = 66;

/**
 * icon-size at the two zoom stops every pin layer interpolates between.
 *
 * Sized so a pin ends up ~40px across at the near stop, matching the 39x48 council-file pins on
 * /map (`.map-project-marker` in app.css) -- the two pin sets share a map, so they read as peers
 * rather than one being the headline. Those are fixed-size DOM markers and these scale with
 * zoom, so they can only agree at one stop; the near stop is the one where both are legible.
 */
const ICON_TARGET_NEAR_PX = 40;
const ICON_TARGET_FAR_PX = 22;
const ICON_SCALE_NEAR = ICON_TARGET_NEAR_PX / ICON_RENDER_PX;
const ICON_SCALE_FAR = ICON_TARGET_FAR_PX / ICON_RENDER_PX;

export function iconSizeAtScale(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    ICON_SCALE_FAR * scale,
    14,
    ICON_SCALE_NEAR * scale,
  ] as unknown as ExpressionSpecification;
}

/**
 * A circle radius that tracks the icon at both zoom stops.
 *
 * `scale` is the icon scale the circle is sizing against, `padPx` a constant ring on top. Derived
 * rather than hardcoded so changing ICON_SCALE_* moves the backing disc and the glow with it.
 */
function radiusTrackingIcon(scale: number, padPx = 0): ExpressionSpecification {
  const half = ICON_RENDER_PX / 2;
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    ICON_SCALE_FAR * scale * half + padPx,
    14,
    ICON_SCALE_NEAR * scale * half + padPx,
  ] as unknown as ExpressionSpecification;
}

/**
 * The pins, as a symbol layer since they now carry artwork rather than a colour.
 *
 * `icon-allow-overlap` and `icon-ignore-placement` are both on deliberately. MapLibre's default
 * is to hide a colliding symbol, which would silently drop civic resources from the map with
 * nothing to say so -- a worse failure than crowding, because the reader cannot tell it happened.
 */
export const assetPointLayer: Omit<SymbolLayerSpecification, "source"> = {
  id: ASSET_POINTS_LAYER_ID,
  type: "symbol",
  layout: {
    "icon-image": categoryIconExpression,
    "icon-size": iconSizeAtScale(1),
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
};

/**
 * White disc behind every pin.
 *
 * The supplied SVGs are full-bleed circles with no outer ring, so without this a pin sitting on
 * another pin has no edge between them, and a pin on the pale neighbourhood fill has no
 * separation from it. Drawn as its own layer rather than edited into the artwork, so replacing
 * a pin file stays a one-file change.
 */
export const assetPointBackingLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "cd2-asset-points-backing",
  type: "circle",
  paint: {
    "circle-color": "#ffffff",
    "circle-radius": radiusTrackingIcon(1, 1.5),
  },
};

/**
 * Hover state for a pin: a second, larger circle drawn over the base layer.
 *
 * A separate filtered layer rather than a `case` expression on the base layer's radius -- the
 * same idiom `csaHighlightLayer` and `districtHighlightLayer` already use, and it keeps the
 * base layer's paint constant so MapLibre is not rebuilding it on every mouse move.
 */
export function buildAssetHoverLayer(
  identity: AssetIdentity | null,
): Omit<SymbolLayerSpecification, "source"> {
  return {
    id: "cd2-asset-points-hover",
    type: "symbol",
    // Composite, like the selection layers: filtering on `label` alone enlarged both
    // "South Weddington Park" pins whenever the cursor was over either one.
    filter: buildAssetSelectionFilter(identity),
    layout: {
      "icon-image": categoryIconExpression,
      "icon-size": iconSizeAtScale(HOVER_ICON_SCALE),
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  };
}

/** MapLibre filter keeping only the categories currently toggled on in the legend. */
export function buildCategoryFilter(active: readonly string[]): ExpressionSpecification {
  return [
    "in",
    ["get", "category"],
    ["literal", [...active]],
  ] as unknown as ExpressionSpecification;
}

/**
 * Matches exactly one pin, for the selection layers below.
 *
 * Three fields rather than `label` alone because labels are not unique: "South Weddington Park"
 * is two genuinely different points in the source data. Same composite `assetKey` uses, for the
 * same reason -- a label-only filter would light up both.
 *
 * Takes loose strings rather than `AssetProperties` on purpose: `cd2Assets.ts` imports this
 * module, so importing its types back would make a cycle.
 */
export interface AssetIdentity {
  category?: string;
  neighborhood?: string;
  label?: string;
}

export function buildAssetSelectionFilter(
  identity: AssetIdentity | null,
): ExpressionSpecification {
  if (!identity?.label) {
    return ["==", ["get", "label"], "\u0000no-asset"] as unknown as ExpressionSpecification;
  }
  return [
    "all",
    ["==", ["get", "label"], identity.label],
    ["==", ["get", "category"], identity.category ?? ""],
    ["==", ["get", "neighborhood"], identity.neighborhood ?? ""],
  ] as unknown as ExpressionSpecification;
}

/** Selected pin: the base icon plus half again, at every zoom the base layer interpolates. */
const SELECTED_ICON_SCALE = 1.5;
/** Hover is a smaller lift than selection, so the two states stay distinguishable. */
const HOVER_ICON_SCALE = 1.2;
/** The glow's reach past the selected icon's own edge. Wide enough to read as a halo. */
const SELECTED_GLOW_SCALE = 1.7;

/**
 * The glow, as a blurred circle under the selected pin rather than a CSS shadow -- the pins are
 * painted into the WebGL canvas, where no CSS reaches them.
 *
 * `circle-blur` feathers the edge; the low opacity keeps it a halo rather than a second dot.
 * It carries the pin's own category colour so the selection never recolours the thing it marks.
 */
export function buildSelectedAssetGlowLayer(
  identity: AssetIdentity | null,
): Omit<CircleLayerSpecification, "source"> {
  return {
    id: "cd2-asset-points-selected-glow",
    type: "circle",
    filter: buildAssetSelectionFilter(identity),
    paint: {
      "circle-color": categoryColorExpression,
      "circle-blur": 0.9,
      "circle-opacity": 0.5,
      "circle-radius": radiusTrackingIcon(SELECTED_ICON_SCALE * SELECTED_GLOW_SCALE),
    },
  };
}

/**
 * The selected pin itself: its own icon at 1.5x.
 *
 * Size and glow together, never glow alone -- a halo at the same size reads as a rendering
 * artefact, and size alone is easy to miss among 68 pins.
 */
export function buildSelectedAssetLayer(
  identity: AssetIdentity | null,
): Omit<SymbolLayerSpecification, "source"> {
  return {
    id: "cd2-asset-points-selected",
    type: "symbol",
    filter: buildAssetSelectionFilter(identity),
    layout: {
      "icon-image": categoryIconExpression,
      "icon-size": iconSizeAtScale(SELECTED_ICON_SCALE),
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  };
}

/** The white disc under the selected pin, sized to its enlarged icon. */
export function buildSelectedAssetBackingLayer(
  identity: AssetIdentity | null,
): Omit<CircleLayerSpecification, "source"> {
  return {
    id: "cd2-asset-points-selected-backing",
    type: "circle",
    filter: buildAssetSelectionFilter(identity),
    paint: {
      "circle-color": "#ffffff",
      "circle-radius": radiusTrackingIcon(SELECTED_ICON_SCALE, 1.5),
    },
  };
}
