import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

/**
 * MyLA311 homeless-encampment reports for Council District 2, 2026 year to date — 4,936 points,
 * normalized once by `scripts/build_encampment_reports.py` (see its docstring for every cleaning
 * rule) and committed. Handed to the `<Source>` as a URL rather than fetched by the page: nothing
 * else on the page reads the collection, so MapLibre can own the fetch, and unmounting the source
 * when the layer is toggled off is all it takes to never download it.
 *
 * 1.87 MB raw, ~140 KB gzipped on the wire.
 */
export const ENCAMPMENT_GEOJSON_PATH = new URL(
  "data/cd2-encampment-reports.geojson",
  window.location.origin + import.meta.env.BASE_URL,
).toString();

/**
 * Up to 48 reports share one exact coordinate, so clustering is on. Past `clusterMaxZoom` the
 * reports render unclustered — identical coordinates stay stacked, and a click on the stack reads
 * every report under the cursor (see `reportsAtClickedPoint`).
 */
export const ENCAMPMENT_CLUSTER_MAX_ZOOM = 15;
export const ENCAMPMENT_CLUSTER_RADIUS = 40;

/**
 * Orange-700 with a white stroke: distinct from the blue choropleth and the green shelter points,
 * and dark enough to read over the palest choropleth class (`#cde2fb`); the stroke carries it
 * over the darkest (`#0d366b`), the same role it plays on `shelterPointLayer`.
 */
export const ENCAMPMENT_COLOR = "#c2410c";

export const ENCAMPMENT_NOTE =
  "Each dot is a 311 report, not an encampment or a count of people. Every record's status is still “Reported”.";

export const encampmentClusterLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "encampment-clusters",
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": ENCAMPMENT_COLOR,
    "circle-opacity": 0.85,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
    "circle-radius": [
      "step",
      ["get", "point_count"],
      12,
      10,
      16,
      100,
      22,
    ] as unknown as ExpressionSpecification,
  },
};

export const encampmentClusterCountLayer: Omit<SymbolLayerSpecification, "source"> = {
  id: "encampment-cluster-count",
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"] as unknown as ExpressionSpecification,
    "text-font": ["Open Sans Semibold"],
    "text-size": 12,
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#ffffff",
  },
};

export const encampmentPointLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "encampment-points",
  type: "circle",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": ENCAMPMENT_COLOR,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
    "circle-radius": 6,
  },
};

interface ClickedFeature {
  layer?: { id?: string };
  geometry?: unknown;
  properties: Record<string, unknown>;
}

function pointKey(geometry: unknown): string | null {
  const coordinates = (geometry as { coordinates?: unknown } | null)?.coordinates;
  return Array.isArray(coordinates) ? JSON.stringify(coordinates) : null;
}

/**
 * Every report stacked at the topmost clicked point. `features` is MapLibre's own hit-test of the
 * interactive layers under the cursor, which already includes every circle drawn at that spot —
 * so no second `queryRenderedFeatures` call is needed. Narrowed to the exact coordinate of the
 * topmost report so a neighboring point whose circle happens to overlap isn't listed as if it were
 * at the same address. Newest first (`created` is ISO, so string order is date order).
 *
 * De-duplicated by case number: a point near a tile edge is drawn in both tiles' buffers, and
 * MapLibre only de-duplicates hits for features with an id, which this source's features lack.
 */
export function reportsAtClickedPoint(features: ClickedFeature[]): Record<string, unknown>[] {
  const points = features.filter((feature) => feature.layer?.id === encampmentPointLayer.id);
  const key = points[0] ? pointKey(points[0].geometry) : null;
  const byCase = new Map<unknown, Record<string, unknown>>();
  for (const feature of points) {
    if (pointKey(feature.geometry) === key && !byCase.has(feature.properties.caseNumber)) {
      byCase.set(feature.properties.caseNumber, feature.properties);
    }
  }
  return [...byCase.values()].sort((a, b) => String(b.created ?? "").localeCompare(String(a.created ?? "")));
}
