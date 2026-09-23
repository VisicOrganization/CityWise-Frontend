/**
 * Jurisdiction-specific presets (currently just LA Council District 2) deliberately isolated in
 * their own module: adding another district, or another city's council map entirely, only ever
 * touches this file — never the core CSA pipeline in `csaIndex.ts` / `csaLayers.ts`.
 *
 * CSA boundaries are not identical to council district boundaries. Each `csaLabels` list is a
 * CSA-level approximation of the named district for this demo, not an authoritative boundary.
 */

export interface CouncilDistrict {
  id: string;
  label: string;
  csaLabels: string[];
  /** `[[west, south], [east, north]]` — MapLibre's `LngLatBoundsLike` order. */
  bounds: [[number, number], [number, number]];
}

export const COUNCIL_DISTRICTS: CouncilDistrict[] = [
  {
    id: "cd2",
    label: "District 2",
    csaLabels: [
      "Los Angeles - North Hollywood",
      "Los Angeles - Studio City",
      "Los Angeles - Sun Valley",
      "Los Angeles - Toluca Lake",
      "Los Angeles - Valley Glen",
      "Los Angeles - Valley Village",
      "Los Angeles - Van Nuys",
    ],
    // True extent of the 7 CSAs above, queried from the Homeless_Counts_2020 FeatureServer with
    // returnExtentOnly on 2026-09-19 (returnCountOnly confirmed all 7 features matched — this is
    // the full extent, not a partial one). Rounded to 5 decimal places: sub-meter precision on a
    // district bounding box is noise.
    bounds: [
      [-118.50268, 34.11904],
      [-118.26682, 34.25721],
    ],
  },
];

// `buildHiddenForDistrict` / `isHiddenSetForDistrict` lived here to translate a district into the
// 297 labels a user-editable neighborhood filter had to hide, and to tell whether the live filter
// still matched a preset. There is no such filter any more — `HomelessCountPage` names this
// district's 7 `csaLabels` directly (`buildVisibleCsaFilter`) — so both are gone rather than kept
// as a hidden-set vocabulary nothing speaks.
