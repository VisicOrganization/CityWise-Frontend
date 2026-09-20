import { useEffect, useState } from "react";

import type { FeatureCollection, Point, Polygon } from "geojson";

import { DISTRICT_PROJECTS_CATEGORY } from "./neighborhoodMapLayers";

/**
 * Civic-asset pins and neighbourhood outlines for one council district's overview panel.
 *
 * Both files are generated offline by `scripts/build_cd2_assets.py` and committed; nothing
 * here geocodes. See that script for why a pin outside the district is kept rather than
 * dropped (the source page lists what *serves* each neighbourhood, not what sits inside CD2).
 *
 * Only District 2 has data today. Everything jurisdiction-specific is the registry below, so
 * adding a district is one entry plus two generated files -- no change to the overlay, the
 * layers, or the popup.
 */

/**
 * The district the committed dataset describes.
 *
 * The overlay lives on /map, where the user may be looking at any district, so this is NOT
 * "the district currently in view" -- it is which district's resources the toggle shows, and
 * what a pin's `council_district` is compared against to decide whether the popup says
 * "Located in Council District 6".
 */
export const NEIGHBORHOOD_DISTRICT_ID = 2;

export interface AssetProperties {
  label: string;
  category: string;
  neighborhood: string;
  address?: string;
  phone?: string;
  email?: string;
  meeting_information?: string;
  website?: string;
  /** Which council district the point actually falls in; absent if outside the City of LA. */
  council_district?: number;
  /** Comma-joined neighbourhood list, present only on pins merged from several rows. */
  serves?: string;
  precision: "rooftop" | "street" | "name" | "intersection";
}

export interface NeighborhoodProperties {
  CSA_Label: string;
  /** The CD2 page this neighbourhood's rows were transcribed from (sheet column `source_url`). */
  source_url?: string;
}

export type AssetCollection = FeatureCollection<Point, AssetProperties>;

/**
 * `district_source_url` is a foreign member on the collection, not on a feature: the district's
 * own page has no polygon to hang on, because "Districtwide" is a pin grouping rather than a
 * CSA. RFC 7946 s6.1 allows it, and `build_cd2_assets.py` writes it from the same sheet column.
 */
export type NeighborhoodCollection = FeatureCollection<Polygon, NeighborhoodProperties> & {
  district_source_url?: string;
};

interface DistrictAssetSource {
  assets: string;
  neighborhoods: string;
  /** [[west, south], [east, north]] -- the framing the panel opens at. */
  bounds: [[number, number], [number, number]];
}

const DISTRICT_ASSET_SOURCES: Record<number, DistrictAssetSource> = {
  2: {
    assets: "data/cd2-civic-assets.geojson",
    neighborhoods: "data/cd2-neighborhoods.geojson",
    // Same box as homelessCount/councilDistricts.ts uses for its CD2 preset.
    bounds: [
      [-118.50268, 34.11904],
      [-118.26682, 34.25721],
    ],
  },
};

export function getDistrictAssetSource(districtId: number): DistrictAssetSource | null {
  return DISTRICT_ASSET_SOURCES[districtId] ?? null;
}

export function hasNeighborhoodMap(districtId: number): boolean {
  return getDistrictAssetSource(districtId) !== null;
}

/** Same URL construction as csaIndex.ts / csaLayers.ts, so BASE_URL is honoured. */
function assetUrl(path: string): string {
  return new URL(path, window.location.origin + import.meta.env.BASE_URL).toString();
}

interface LoadedAssets {
  assets: AssetCollection;
  neighborhoods: NeighborhoodCollection;
}

/**
 * Per-district promise memo, in the same spirit as `loadCsaGeojsonOnce`: the panel unmounts
 * and remounts as the overview sheet opens and closes, and neither file should be refetched
 * for that. The memo is cleared on failure so a transient error can be retried.
 */
const cache = new Map<number, Promise<LoadedAssets>>();

export function resetCd2AssetCacheForTests(): void {
  cache.clear();
}

export function loadDistrictAssetsOnce(districtId: number): Promise<LoadedAssets> {
  const existing = cache.get(districtId);
  if (existing) {
    return existing;
  }

  const source = getDistrictAssetSource(districtId);
  if (!source) {
    return Promise.reject(new Error(`no neighborhood map data for district ${districtId}`));
  }

  const pending = Promise.all([
    fetch(assetUrl(source.assets)).then(readCollection),
    fetch(assetUrl(source.neighborhoods)).then(readCollection),
  ])
    .then(([assets, neighborhoods]) => ({
      assets: assets as AssetCollection,
      neighborhoods: neighborhoods as NeighborhoodCollection,
    }))
    .catch((error: unknown) => {
      cache.delete(districtId);
      throw error;
    });

  cache.set(districtId, pending);
  return pending;
}

async function readCollection(response: Response): Promise<FeatureCollection> {
  if (!response.ok) {
    throw new Error(`neighborhood map data request failed: ${response.status}`);
  }
  const payload = (await response.json()) as FeatureCollection;
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("neighborhood map data is not a FeatureCollection");
  }
  return payload;
}

/**
 * `null` while loading, if the data could not be loaded, or while `enabled` is false; the
 * overlay then draws nothing.
 *
 * `enabled` is gated on the map's toggle so a session that never turns the overlay on never
 * fetches either file -- the same shape as `useCouncilDistrictBoundary(enabled)`.
 */
export function useDistrictAssets(districtId: number, enabled = true): LoadedAssets | null {
  const [loaded, setLoaded] = useState<LoadedAssets | null>(null);

  useEffect(() => {
    if (!enabled || !hasNeighborhoodMap(districtId)) {
      setLoaded(null);
      return;
    }
    let ignore = false;
    loadDistrictAssetsOnce(districtId)
      .then((result) => {
        if (!ignore) {
          setLoaded(result);
        }
      })
      .catch(() => {
        // Silent by design: this panel is context beside the legislation, not the page's
        // content. A failed load must leave the rest of the overview sheet alone.
        if (!ignore) {
          setLoaded(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, [districtId, enabled]);

  return loaded;
}

/**
 * The CD2 page behind a panel, straight from the sheet's `source_url` column.
 *
 * Read off the generated data rather than a hardcoded table in this file: the workbook is the
 * source of truth for all eight URLs (seven neighbourhoods plus the district), and
 * `build_cd2_assets.py` refuses to build if a level's rows disagree about theirs. A registry
 * here would be the same jurisdiction data in a second place, free to drift.
 *
 * `null` rather than a thrown error when it is missing -- the panel degrades to a placeholder
 * row, the same as any other absent field.
 */
export function getPanelSourceUrl(
  neighborhoods: NeighborhoodCollection,
  selection: PanelSelection,
): string | null {
  if (selection.kind === "district") {
    return readUrl(neighborhoods.district_source_url);
  }
  const match = neighborhoods.features.find(
    (feature) => feature.properties?.CSA_Label === selection.csaLabel,
  );
  return readUrl(match?.properties?.source_url);
}

/** Only http(s) is rendered as a link, so a malformed cell cannot become a `javascript:` href. */
function readUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** "Los Angeles - Sun Valley" -> "Sun Valley", matching the on-map label layer. */
export function shortNeighborhoodName(label: string): string {
  return label.startsWith("Los Angeles - ") ? label.slice("Los Angeles - ".length) : label;
}

/** The inverse, for routing a pin's `neighborhood`/`serves` value back to a CSA polygon. */
export function csaLabelFor(shortName: string): string {
  return shortName.startsWith("Los Angeles - ") ? shortName : `Los Angeles - ${shortName}`;
}

/** Pin grouping values that are not real neighbourhoods and have no CSA polygon. */
const DISTRICTWIDE = "Districtwide";
const MULTIPLE = "Multiple neighborhoods";

/** Which side panel is open. `district` is the Districtwide/uncategorised bucket. */
export type PanelSelection =
  | { kind: "neighborhood"; csaLabel: string }
  | { kind: "district" };

/**
 * One card: the id that lets a pin click scroll to it, and the point that lets clicking the
 * card move the map back the other way.
 */
export interface PanelAsset {
  key: string;
  longitude: number;
  latitude: number;
  properties: AssetProperties;
}

/**
 * Stable per-pin id, derived only from fields a clicked map feature also carries -- so the same
 * key is computed from the click and from the card, with no lookup between them.
 *
 * Label alone is not unique: "South Weddington Park" appears twice in RECREATION & PARKS, as two
 * genuinely different points (Valleyheart & Lankershim in Studio City, and 10600 Valleyheart in
 * Toluca Lake). Adding `neighborhood` makes all 68 keys distinct. Coordinates would be the
 * obvious discriminator but are deliberately NOT used: MapLibre returns a queried feature's
 * geometry from quantised tile space, so they would not match the source file's values.
 */
export function assetKey(properties: Partial<AssetProperties>): string {
  const category = typeof properties.category === "string" ? properties.category : "";
  const neighborhood = typeof properties.neighborhood === "string" ? properties.neighborhood : "";
  const label = typeof properties.label === "string" ? properties.label : "";
  return `${category}|${neighborhood}|${label}`;
}

/** The neighbourhoods a pin belongs to, with the non-neighbourhood grouping values removed. */
function servedNeighborhoods(properties: Partial<AssetProperties>): string[] {
  const serves = (properties.serves ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidates = serves.length > 0 ? serves : [properties.neighborhood ?? ""];
  return candidates.filter((entry) => entry && entry !== DISTRICTWIDE && entry !== MULTIPLE);
}

/**
 * The pins that belong to one neighbourhood's detail panel.
 *
 * Membership is `neighborhood` OR a mention in `serves`, because the build merges a facility
 * that the sheet lists once per neighbourhood it serves into a single pin whose `neighborhood`
 * becomes the literal string "Multiple neighborhoods" (see `build_cd2_assets.py`). Matching on
 * `neighborhood` alone would drop the North Hollywood Police Station from all four of the
 * neighbourhoods it actually serves.
 *
 * "Districtwide" pins are deliberately excluded: they are district-level items (the council
 * office, medians, bike paths) that would otherwise pad all seven panels with the same 16 rows
 * and bury what is specific to the neighbourhood the user just clicked. They have their own
 * panel -- `selectDistrictAssets` below.
 */
export function selectNeighborhoodAssets(
  assets: AssetCollection,
  csaLabel: string,
): PanelAsset[] {
  const short = shortNeighborhoodName(csaLabel);
  return toPanelAssets(assets, (properties) => servedNeighborhoods(properties).includes(short));
}

/**
 * The District Overview panel's pins: the whole synthesized `DISTRICT PROJECTS & OFFICE`
 * category, not a `neighborhood === "Districtwide"` test.
 *
 * Category, because routing has to be total -- a clicked pin must always be findable in the
 * panel it opens. One pin (Tujunga Green Belt) is in this category with `serves = "Districtwide,
 * Valley Glen"`, so it also appears in the Valley Glen panel. That is correct: it genuinely
 * serves both. Its click routes here, because category is what decides.
 */
export function selectDistrictAssets(assets: AssetCollection): PanelAsset[] {
  return toPanelAssets(
    assets,
    (properties) => properties.category === DISTRICT_PROJECTS_CATEGORY,
  );
}

export function selectPanelAssets(
  assets: AssetCollection,
  selection: PanelSelection,
): PanelAsset[] {
  return selection.kind === "district"
    ? selectDistrictAssets(assets)
    : selectNeighborhoodAssets(assets, selection.csaLabel);
}

function toPanelAssets(
  assets: AssetCollection,
  keep: (properties: AssetProperties) => boolean,
): PanelAsset[] {
  const panelAssets: PanelAsset[] = [];
  for (const feature of assets.features) {
    const properties = feature.properties;
    if (!properties || !keep(properties)) {
      continue;
    }
    // A card with no point cannot move the map, so it is not rendered at all -- the build only
    // ever writes located rows, so this is a guard against a malformed file, not a real case.
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      continue;
    }
    panelAssets.push({
      key: assetKey(properties),
      longitude: coordinates[0],
      latitude: coordinates[1],
      properties,
    });
  }
  return panelAssets;
}

/**
 * Which panel a clicked pin opens.
 *
 * `current` is the panel already open, and it wins whenever it still contains the pin: clicking
 * a police station that serves four neighbourhoods should scroll the panel you are reading, not
 * throw you into the first neighbourhood in its `serves` list. Only when the open panel cannot
 * show the pin does this switch, and then it picks the first neighbourhood the pin serves.
 *
 * `null` for a pin that belongs nowhere -- a neighbourhood-level row whose only grouping values
 * were "Districtwide"/"Multiple neighborhoods". The build does not currently emit one, and the
 * caller leaves the open panel alone rather than opening an empty one.
 */
export function resolvePanelSelection(
  properties: Partial<AssetProperties>,
  current: PanelSelection | null,
): PanelSelection | null {
  if (properties.category === DISTRICT_PROJECTS_CATEGORY) {
    return { kind: "district" };
  }

  const served = servedNeighborhoods(properties);
  if (served.length === 0) {
    return null;
  }
  if (
    current?.kind === "neighborhood" &&
    served.includes(shortNeighborhoodName(current.csaLabel))
  ) {
    return current;
  }
  return { kind: "neighborhood", csaLabel: csaLabelFor(served[0]) };
}
