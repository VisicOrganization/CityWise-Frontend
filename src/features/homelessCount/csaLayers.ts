import { useEffect, useState } from "react";

import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
} from "maplibre-gl";

/**
 * The LAHSA 2020 homeless count by Countywide Statistical Area, as a GeoJSON file committed to
 * this repo and served from `public/data` — not a tile source.
 *
 * WHY IT IS LOCAL. This layer used to read Scout's vector tiles (`?datasets=query`). On
 * 2026-09-19 Scout REPLACED the contents of that dataset in place, under the same name: where it
 * had served the 304 CSA polygons carrying `CSA_Label` / `Total_Pop` / `Density_Total` and the
 * sheltered/unsheltered split, it now serves a mix of administrative geographies (County,
 * Cities, Council Districts, SPAs, Supervisorial Districts, Neighborhoods) on a different schema
 * entirely (`Geo_ID`/`Geo_Type`/`Geo_Name`/`Homeless`), and its neighborhood features carry no
 * count data at all — so the choropleth rendered nothing. A third-party endpoint that can swap
 * a dataset's schema out from under a stable name is not a trustworthy source for this layer, so
 * it is pinned to a committed extract of the authoritative publisher instead. The sibling
 * `homeless_shelters_and_services` dataset is unaffected and that layer still reads Scout tiles.
 *
 * Regenerate with (verified 2026-09-19 against the authoritative LA County ArcGIS FeatureServer,
 * which still serves the original layer: 1,126,964 bytes, exactly 304 features, zero null
 * geometries, no paging needed):
 *
 *   curl -s -G 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Homeless_Counts_2020/FeatureServer/0/query' \
 *     --data-urlencode 'where=1=1' \
 *     --data-urlencode 'outFields=CSA_Label,Total_Pop,Total_Unsheltered_Pop,Total_Sheltered_Pop,Density_Total,Density_Unsheltered,Density_Sheltered,Square_Miles,Data_Source' \
 *     --data-urlencode 'outSR=4326' \
 *     --data-urlencode 'f=geojson' \
 *     --data-urlencode 'geometryPrecision=5' \
 *     --data-urlencode 'maxAllowableOffset=0.00002' \
 *     --data-urlencode 'orderByFields=CSA_Label' \
 *     -o public/data/lahsa-2020-csa.geojson
 *
 * `orderByFields` keeps the committed file deterministic so regenerating produces a clean diff —
 * the same reasoning as the index file in `csaIndex.ts`.
 *
 * NOTE: this file now carries `CSA_Label` and `Total_Pop` for all 304 areas, which makes it
 * partially redundant with `public/data/lahsa-2020-csa-index.json` (see `CSA_INDEX_PATH`). The
 * index still backs the neighborhood filter list and is deliberately left in place: collapsing
 * the two would make the filter dropdown wait on a 1.1 MB download it does not otherwise need,
 * and that is a separate decision from this one.
 */
export const CSA_GEOJSON_PATH = new URL("data/lahsa-2020-csa.geojson", window.location.origin + import.meta.env.BASE_URL).toString();

/**
 * Floor for the map's zoom range, kept purely for viewport framing: below it the whole county
 * shrinks into a corner of a mostly-empty world map, which is not a useful view of a Los Angeles
 * dataset. It is NOT a data-completeness guard any more — the GeoJSON source above hands
 * MapLibre all 304 features at once, so every area is present at every zoom. (The constant
 * originally existed because the old tile server silently dropped features below z5; that
 * constraint died with the tile source.)
 */
export const CSA_MIN_ZOOM = 7;

/** Polygons with whatever attributes the regenerated file happens to carry — read defensively
 * at the point of use (see `CsaDistrictSummary`/`CsaDetailPopup`) rather than trusted by type,
 * since this is a published extract we did not author. */
export type CsaFeatureCollection = FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>;

/**
 * Module-level memo, same shape as `loadCsaIndexOnce` in `csaIndex.ts` and
 * `loadCouncilDistrictBoundaryOnce` in `councilDistrictBoundary.ts`: the choropleth toggle
 * unmounts and remounts this page's consumers, and re-downloading 1.1 MB each time is not
 * acceptable.
 *
 * This is the *only* fetch of `CSA_GEOJSON_PATH`. `HomelessCountPage` calls this loader once,
 * then hands the parsed collection to both consumers directly: `<Source type="geojson"
 * data={collection}>` for the map (MapLibre never sees the URL, so its worker never issues a
 * second request for it) and the left panel's per-neighborhood split, via `csaPropertiesByLabel`.
 * That makes every one of the 304 areas present as soon as this promise resolves — no viewport
 * dependency, no separate "tile hasn't loaded yet" state to track — at the cost of a few ms of
 * JSON parsing on the main thread, which is cheaper than downloading the same 1.1 MB twice on a
 * cold load.
 */
let csaGeojsonPromise: Promise<CsaFeatureCollection> | null = null;

export function resetCsaGeojsonCacheForTests(): void {
  csaGeojsonPromise = null;
}

export function loadCsaGeojsonOnce(): Promise<CsaFeatureCollection> {
  if (!csaGeojsonPromise) {
    csaGeojsonPromise = fetch(CSA_GEOJSON_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load the neighborhood boundaries");
        }
        return response.json() as Promise<CsaFeatureCollection>;
      })
      .catch((error: unknown) => {
        // Clear the memo so a transient failure can be retried on the next mount.
        csaGeojsonPromise = null;
        throw error;
      });
  }
  return csaGeojsonPromise;
}

/**
 * Attributes keyed by `CSA_Label`, for the left panel's readout. Skips any feature without a
 * usable string label rather than keying on `undefined` — same fail-safe stance as
 * `buildHiddenCsaFilter`, and the reason a caller can treat a hit here as real data.
 */
export function csaPropertiesByLabel(
  collection: CsaFeatureCollection | null,
): Record<string, Record<string, unknown>> {
  const byLabel: Record<string, Record<string, unknown>> = {};
  for (const feature of collection?.features ?? []) {
    const label = feature.properties?.CSA_Label;
    if (typeof label === "string" && label) {
      byLabel[label] = feature.properties;
    }
  }
  return byLabel;
}

/** Finds one CSA's feature by label, or `undefined` before the file has loaded. Unlike the
 * `querySourceFeatures` lookup this replaced, the answer does not depend on the viewport: every
 * one of the 304 areas is present as soon as the file resolves. */
export function findCsaFeatureByLabel(collection: CsaFeatureCollection | null, label: string) {
  return collection?.features?.find((feature) => feature.properties?.CSA_Label === label);
}

/**
 * Resolves the committed collection, or `null` while loading / if it could not be loaded.
 *
 * Failure is silent here on purpose: this hook only decides what the map and the panel render,
 * not whether to show a data-error message. `HomelessCountPage` awaits the same memoized
 * `loadCsaGeojsonOnce()` promise separately (no extra network request) to set that message, so
 * there is exactly one owner of the one data-error message this page shows, and it is not this
 * hook.
 */
export function useCsaGeojson(): CsaFeatureCollection | null {
  const [collection, setCollection] = useState<CsaFeatureCollection | null>(null);

  useEffect(() => {
    let ignore = false;
    loadCsaGeojsonOnce()
      .then((loaded) => {
        if (!ignore) setCollection(loaded);
      })
      .catch(() => {
        if (!ignore) setCollection(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return collection;
}

/** Verbatim `copyrightText` from the publishing ArcGIS service. */
export const CSA_ATTRIBUTION =
  "Los Angeles Homeless Services Authority (LAHSA); Cities of Glendale, Pasadena & Long Beach; Los Angeles County Enterprise GIS";

export interface DensityLegendStop {
  label: string;
  color: string;
}

/**
 * Single-hue sequential ramp, light to dark, in ramp order. The first entry is the dedicated
 * true-zero class: 23 CSAs counted nobody, and merging them with "one person across 300 sq mi"
 * is a real misread on a homelessness map.
 *
 * Breaks are round numbers snapped to the real quantiles of the 304 rows (p25 5.11, p50 19.65,
 * p75 71.17, p90 203.0), which bins them 23 / 53 / 77 / 81 / 39 / 31.
 * "per sq. mile" lives in the legend title, not in each row.
 */
export const DENSITY_LEGEND_STOPS: DensityLegendStop[] = [
  { label: "0 counted", color: "#e8eaed" },
  { label: "Under 5", color: "#cde2fb" },
  { label: "5–20", color: "#9ec5f4" },
  { label: "20–75", color: "#5598e7" },
  { label: "75–200", color: "#256abf" },
  { label: "200+", color: "#0d366b" },
];

/** Lower bound of each density class after the first. Length is `DENSITY_LEGEND_STOPS - 2`. */
const DENSITY_BREAKS = [5, 20, 75, 200];

const [zeroStop, ...densityStops] = DENSITY_LEGEND_STOPS;

/**
 * Built from `DENSITY_LEGEND_STOPS` rather than restated, so the legend and the map physically
 * cannot drift apart. `step`, not `interpolate`: six named swatches are directly readable, and
 * with a p90/max ratio near 15x a continuous ramp would crush 90% of CSAs into one shade.
 *
 * Both `get`s are wrapped in `to-number(…, 0)` rather than passed raw. MapLibre's style-spec
 * default for `fill-color` is `#000000`, and it falls back to that default for the *entire*
 * layer whenever a paint expression fails to evaluate for a feature — `step` throws if its input
 * isn't a number, and a bare `["get", "Density_Total"]` is `null` for any feature that lacks the
 * attribute. This was a live bug against the old tile source, whose layer carried features with
 * no `Density_Total`/`Total_Pop` at all. Every feature in the committed GeoJSON now does carry
 * both (verified on regeneration, 2026-09-19: 0 of 304 missing either), so this is no longer
 * load-bearing for today's data — it is kept as defense in depth, because the cost of one
 * missing attribute in a future regeneration is the entire layer turning black rather than one
 * polygon looking wrong. `to-number(null, 0)` evaluates to `0` rather than throwing, so such a
 * feature lands in the lightest defined bucket instead of blanking the map, independent of
 * whatever filter is applied upstream. Real (non-zero, non-missing) values are converted to
 * themselves, so the ramp/legend mapping for actual CSA data is unchanged.
 */
export const csaFillColorExpression = [
  "case",
  ["==", ["to-number", ["get", "Total_Pop"], 0], 0],
  zeroStop.color,
  [
    "step",
    ["to-number", ["get", "Density_Total"], 0],
    densityStops[0].color,
    ...DENSITY_BREAKS.flatMap((breakpoint, index) => [breakpoint, densityStops[index + 1].color]),
  ],
] as unknown as ExpressionSpecification;

/**
 * Constant opacity, deliberately not zoom-interpolated like `districtFillOpacityExpression`:
 * the district map fades because pins sit on top of it, but here the polygons *are* the content.
 */
export const csaFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "csa-fill",
  type: "fill",
  paint: {
    "fill-color": csaFillColorExpression,
    "fill-opacity": 0.72,
  },
};

export const csaOutlineLayer: Omit<LineLayerSpecification, "source"> = {
  id: "csa-outline",
  type: "line",
  paint: {
    "line-color": "#ffffff",
    "line-width": 0.8,
    "line-opacity": 0.85,
  },
};

/**
 * Selected-neighborhood border highlight. The existing `csaOutlineLayer` is a thin (0.8px),
 * mostly-transparent white line meant to separate every polygon from its neighbors — it is not
 * built to be noticed. This layer needs the opposite job: a single CSA's border has to visibly
 * pop against both ends of the blue ramp at once (`#cde2fb` pale, `#0d366b` dark), so it reuses
 * `#f97316`, the same selection-orange `districtHighlightLayer` already uses elsewhere in this
 * app (`shared/map/districtLayers.ts`) for the same "this one is selected" role. Rendered only
 * when something is selected (see `HomelessCountPage.tsx`), with a heavier weight and full
 * opacity so it reads as a highlight rather than another polygon edge.
 */
export const csaHighlightLayer: Omit<LineLayerSpecification, "source"> = {
  id: "csa-highlight",
  type: "line",
  paint: {
    "line-color": "#f97316",
    "line-width": 3,
    "line-opacity": 1,
  },
};

/**
 * Builds the highlight layer's filter from the selected CSA's label. `null` (nothing selected)
 * returns `undefined` rather than a filter that matches nothing — callers are expected to not
 * render the highlight layer at all when nothing is selected (see `HomelessCountPage.tsx`), so
 * this never actually reaches MapLibre in the null case. Unlike `buildHiddenCsaFilter`, this one
 * has no fail-open risk to guard against: it only ever runs against a label a real feature
 * already produced (a click or a district preset), never against tile features in general, so
 * there is no "no-op" case for it to get wrong.
 */
export function buildSelectedCsaFilter(selectedLabel: string | null): FilterSpecification | undefined {
  if (!selectedLabel) {
    return undefined;
  }
  return ["==", ["get", "CSA_Label"], selectedLabel] as FilterSpecification;
}

/**
 * Filters the *hidden* set, not the visible one — but every filter this returns also requires
 * `CSA_Label` to actually be a usable string, which is the part that used to be missing.
 *
 * The exclusion-list shape used to short-circuit to literally `undefined` ("no filter") when
 * nothing was hidden, on the theory that "everything shown" needs no special case and a
 * 304-entry hidden list correctly renders nothing for free. That reasoning assumed every feature
 * in the source is a CSA carrying a `CSA_Label` string — which was false for the old tile
 * source, whose layer also carried non-CSA administrative polygons (council districts,
 * supervisorial districts, service planning areas, incorporated cities, the county outline) with
 * no `CSA_Label` attribute at all. `["in", ["get","CSA_Label"], ["literal", hiddenLabels]]` is
 * `false` for a feature with no `CSA_Label` (it can't be "in" a list of strings), so `!false`
 * was `true` and the feature rendered — fail-*open*. That is exactly backwards for a page whose
 * requirement is "only ever show CD2": a feature the filter can't positively identify as a kept
 * CSA must be hidden, not shown, and the same holds with nothing hidden at all — "select all"
 * must mean "all 304 CSAs", not "everything in the source".
 *
 * The committed GeoJSON contains only the 304 labelled CSAs, so this guard is not load-bearing
 * for today's data either (same standing as the `to-number` wrappers above). It stays because
 * the failure it prevents is silent and the direction it fails in is the safe one: an
 * unidentifiable feature is hidden rather than drawn over a district the user scoped the map to.
 *
 * So there is no longer an unconditional no-op case: every returned filter requires
 * `CSA_Label` to be a string, and additionally excludes anything in `hiddenLabels`. "Clear all"
 * (a 304-entry `hiddenLabels`) still renders nothing, same as before — that part of the
 * original reasoning still holds.
 *
 * Still uses the expression form of `in` (`["in", needle, ["literal", […]]]`), not the legacy
 * filter form — only the expression form composes with `!`/`all`.
 */
export function buildHiddenCsaFilter(hiddenLabels: string[]): FilterSpecification {
  const hasCsaLabel = ["==", ["typeof", ["get", "CSA_Label"]], "string"] as ExpressionSpecification;
  if (hiddenLabels.length === 0) {
    return hasCsaLabel as FilterSpecification;
  }
  return [
    "all",
    hasCsaLabel,
    ["!", ["in", ["get", "CSA_Label"], ["literal", hiddenLabels]]],
  ] as FilterSpecification;
}
