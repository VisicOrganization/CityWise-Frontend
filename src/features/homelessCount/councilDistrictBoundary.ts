import { useEffect, useState } from "react";

import {
  findDistrictFeature,
  loadDistrictBoundaries,
  type DistrictBoundaryFeature,
} from "../../shared/map/districtBoundaries";
// Moved to shared/map when the district overview's Neighborhood Map became a second consumer.
// Re-exported here so this page's existing import site and tests keep working unchanged.
export { districtBoundaryLineLayer } from "../../shared/map/districtLayers";

/**
 * The real LA City Council District 2 outline, drawn on top of the CSA choropleth.
 *
 * Why this layer exists at all: `councilDistricts.ts` approximates District 2 with 7 CSAs, and
 * that file says so in its own header — CSA boundaries are *not* council district boundaries.
 * This draws the actual administrative boundary so the difference is visible rather than implied.
 *
 * The GeoJSON itself is loaded through `shared/map/districtBoundaries.ts` (the same loader
 * CityMap and the geocoder already use), not a second fetch of our own. That file ships all 15
 * districts (~1.5 MB); only District 2 is rendered here, but the whole file is still fetched
 * because the loader is shared with CityMap and splitting it would fork that shared module.
 */
export const HOMELESS_COUNT_DISTRICT_ID = 2;

/** The `<Source id>` for the boundary; kept next to the layer so the page has one name to use. */
export const DISTRICT_BOUNDARY_SOURCE_ID = "council-district-boundary";

/**
 * Served path of the shipped GeoJSON, for the left panel's data-sources section.
 *
 * `districtBoundaries.ts` builds this path internally and does not export it, and that module is
 * out of scope to change — so this is the one provenance string in `dataSources.ts` that is a
 * literal rather than an import. `councilDistrictBoundary.test.ts` pins it: it stubs `fetch`,
 * calls the real `loadDistrictBoundaries()`, and asserts the URL actually requested ends with
 * this value. If the shared loader's path moves, that test fails rather than the panel quietly
 * naming a file the app no longer reads.
 */
export const COUNCIL_DISTRICTS_GEOJSON_PATH = "/data/la-city-council-districts.geojson";

/**
 * Module-level memo in the same spirit as `loadCsaIndexOnce` in `csaIndex.ts`: the shared
 * `loadDistrictBoundaries()` is an un-memoized fetch (`useMapData.ts` and `geocodeSearch.ts`
 * each wrap it the same way), and this page must not re-download 1.5 MB every time the layer is
 * toggled back on.
 */
let boundaryPromise: Promise<DistrictBoundaryFeature | undefined> | null = null;

export function resetCouncilDistrictBoundaryCacheForTests(): void {
  boundaryPromise = null;
}

export function loadCouncilDistrictBoundaryOnce(): Promise<DistrictBoundaryFeature | undefined> {
  if (!boundaryPromise) {
    boundaryPromise = loadDistrictBoundaries()
      .then((collection) => findDistrictFeature(collection, HOMELESS_COUNT_DISTRICT_ID))
      .catch((error: unknown) => {
        // Clear the memo so a transient failure can be retried, exactly as `loadCsaIndexOnce`
        // does. A malformed payload lands here too: `findDistrictFeature` reads `.features` off
        // whatever the loader resolved, so a non-collection throws inside this `then`.
        boundaryPromise = null;
        throw error;
      });
  }
  return boundaryPromise;
}

/**
 * Resolves District 2's feature, or `null` while loading / if it could not be loaded.
 *
 * Gated on `enabled` so the file is only fetched for a map that is actually going to draw it.
 * Toggling the layer back off does NOT undo the fetch — the bytes are already on the client, and
 * unlike the two Scout tile sources there is no per-tile request left to stop. Unmounting the
 * layer is purely about the pixels.
 */
export function useCouncilDistrictBoundary(enabled: boolean): DistrictBoundaryFeature | null {
  const [feature, setFeature] = useState<DistrictBoundaryFeature | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let ignore = false;
    loadCouncilDistrictBoundaryOnce()
      .then((loaded) => {
        if (!ignore) {
          setFeature(loaded ?? null);
        }
      })
      .catch(() => {
        // Silent: the boundary is context, not the page's content. A missing outline must not
        // take the choropleth down with it, and `hasTileError` already owns the one data-error
        // message this page shows.
        if (!ignore) {
          setFeature(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, [enabled]);

  return feature;
}
