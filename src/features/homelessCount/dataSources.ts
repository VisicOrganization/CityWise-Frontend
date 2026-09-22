import { LIGHT_BASE_MAP_STYLE } from "../../shared/map/lightBaseMapStyle";
import { COUNCIL_DISTRICTS_GEOJSON_PATH, HOMELESS_COUNT_DISTRICT_ID } from "./councilDistrictBoundary";
import { CSA_ATTRIBUTION, CSA_GEOJSON_PATH } from "./csaLayers";
import { CSA_INDEX_PATH } from "./csaIndex";
import { ENCAMPMENT_GEOJSON_PATH } from "./encampmentLayers";
import { SHELTER_LOW_ZOOM_NOTE, SHELTER_TILES_URL } from "./shelterLayers";

/**
 * Provenance model for the left panel's "Data sources" section.
 *
 * The whole point of this module is that every origin string is *derived* from the constant the
 * app actually requests — `CSA_GEOJSON_PATH`, `SHELTER_TILES_URL`, `CSA_INDEX_PATH`,
 * `LIGHT_BASE_MAP_STYLE` — rather than retyped next to it. A provenance panel that has drifted
 * from the code is worse than no provenance panel, because it is confidently wrong.
 *
 * The one exception is the council-district GeoJSON path: `shared/map/districtBoundaries.ts`
 * keeps its path private and is out of scope to change, so `COUNCIL_DISTRICTS_GEOJSON_PATH` is a
 * literal in this feature — pinned to the shared loader's real request by a test rather than by
 * an import. See that constant's own comment.
 */

/** Which of the page's four layer toggles (owned by the "Layers" section) an entry reflects. */
export type DataSourceToggleKey = "choropleth" | "shelters" | "districtBoundary" | "encampments";

export interface DataSourceEntry {
  id: string;
  /**
   * Always visible, collapsed or not — the `<summary>` line carries `name` AND `origin`, so
   * collapsing an entry never hides where its data comes from.
   */
  name: string;
  origin: string;
  /** Expanded body: what the dataset describes. */
  describes: string;
  /** Expanded body: caveats a reader has to know before quoting this layer. */
  notes: string[];
  /** `null` for entries that are not map layers — those show `staticReason` instead of state. */
  toggleKey: DataSourceToggleKey | null;
  /** Why an entry has no show/hide state at all. Required exactly when `toggleKey` is `null`. */
  staticReason?: string;
}

/**
 * Pulls the `?datasets=` selector out of a Scout tile URL. Deterministic parse of a constant we
 * already have in hand — the alternative is writing "query" twice and letting the two rot apart.
 */
export function scoutDatasetsParam(tilesUrl: string): string {
  return /[?&]datasets=([^&]*)/.exec(tilesUrl)?.[1] ?? "";
}

/** `/data/x.json` (absolute served URL) → `public/data/x.json` (the path in this repo). */
function repoPathForServedFile(servedUrl: string): string {
  const pathname = servedUrl.startsWith("http") ? new URL(servedUrl).pathname : servedUrl;
  return `public${pathname}`;
}

/**
 * Read off the shared basemap style rather than restated, so a change of basemap provider can't
 * leave this section crediting the old one. Narrowed defensively: `sources` is a map of the
 * whole `SourceSpecification` union, and only some members carry `attribution`.
 */
const basemapSource = LIGHT_BASE_MAP_STYLE.sources.raster;
const BASEMAP_ATTRIBUTION =
  "attribution" in basemapSource && typeof basemapSource.attribution === "string"
    ? basemapSource.attribution
    : "";

export const DATA_SOURCES: DataSourceEntry[] = [
  {
    id: "lahsa-count",
    name: "LAHSA 2020 Homeless Count",
    origin: `LAHSA via LA County ArcGIS FeatureServer — committed as ${repoPathForServedFile(CSA_GEOJSON_PATH)}`,
    describes:
      "Persons experiencing homelessness by Countywide Statistical Area (CSA), with the sheltered/unsheltered split and a density per square mile for each. Vintage: the 2020 Point-in-Time count.",
    notes: [
      `Attribution as published: ${CSA_ATTRIBUTION}.`,
      "Glendale, Pasadena and Long Beach are reported citywide rather than by tract.",
      "LAHSA advises against aggregating tract-level data to other geographies, so no total is summed across areas anywhere on this page.",
      "Not read from Scout's vector tiles: Scout replaced the `query` dataset this layer used to read, in place and under the same name, on 2026-09-19, so this layer is pinned to a committed extract of the authoritative publisher instead. See `csaLayers.ts` for the regeneration command.",
    ],
    toggleKey: "choropleth",
  },
  {
    id: "shelters",
    name: "Homeless shelters & services",
    origin: `Scout vector tiles (?datasets=${scoutDatasetsParam(SHELTER_TILES_URL)})`,
    describes: "Shelter and service locations, as points.",
    notes: [SHELTER_LOW_ZOOM_NOTE, `Tiles: ${SHELTER_TILES_URL}`],
    toggleKey: "shelters",
  },
  {
    id: "council-districts",
    name: "LA City Council Districts",
    origin: `Local file ${repoPathForServedFile(COUNCIL_DISTRICTS_GEOJSON_PATH)}`,
    describes: `Council district boundaries for the City of Los Angeles. Only District ${HOMELESS_COUNT_DISTRICT_ID} is drawn here; the file ships all 15 and is shared with the city map.`,
    notes: [
      "Council district boundaries do not align with the CSA boundaries the count is reported by — the dashed outline and the shaded areas are different geographies.",
    ],
    toggleKey: "districtBoundary",
  },
  {
    id: "encampment-reports",
    name: "311 encampment reports (CD2, 2026)",
    origin: `MyLA311 service requests, normalized by scripts/build_encampment_reports.py — committed as ${repoPathForServedFile(ENCAMPMENT_GEOJSON_PATH)}`,
    describes:
      "Homeless-encampment reports filed through MyLA311 in Council District 2, January 1 – September 21, 2026, one point per report.",
    notes: [
      "A report is a request for service, not an encampment and not a count of people: one site can be reported many times, and reports can come from anyone.",
      "Every record's status is \u201cReported\u201d. The export's close date matches the intake time to the second in almost every record, so it is shown only where it differs.",
      "A few dozen reports fall outside any neighborhood council.",
      "Collected six years after the 2020 count underneath, by a different method — the two layers are not comparable.",
    ],
    toggleKey: "encampments",
  },
  {
    id: "csa-index",
    name: "Neighborhood index",
    origin: `Derived from the LA County ArcGIS FeatureServer (same 2020 layer) — committed as ${repoPathForServedFile(CSA_INDEX_PATH)}`,
    describes:
      "The 304-row list of Countywide Statistical Areas backing the neighborhood filter above.",
    notes: [
      "It exists because vector tiles only expose the features in the current viewport, so the full name list has to come from somewhere else.",
    ],
    toggleKey: null,
    staticReason: "Not a map layer",
  },
  {
    id: "basemap",
    name: "Basemap",
    origin: `CARTO light raster tiles — ${BASEMAP_ATTRIBUTION}`,
    describes: "Streets, place names and labels under every other layer on this map.",
    notes: ["It is the base the other layers draw on, so it has no show/hide control."],
    toggleKey: null,
    staticReason: "Always on",
  },
];
