import type { CsaRow } from "./csaIndex";

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

/** Hides every row NOT in the district, so selecting it leaves exactly the district's CSAs visible. */
export function buildHiddenForDistrict(rows: CsaRow[], district: CouncilDistrict): Set<string> {
  const visible = new Set(district.csaLabels);
  return new Set(rows.filter((row) => !visible.has(row.CSA_Label)).map((row) => row.CSA_Label));
}

/**
 * True iff `hidden` is exactly the hidden-set `buildHiddenForDistrict` would produce for this
 * district — i.e. the live neighborhood filter still matches the district preset exactly, not
 * approximately. Used by the left-panel district readout (`HomelessCountPage.tsx`) to decide
 * whether to follow the user's current filter or fall back to a fixed default: if they have
 * hand-edited a checkbox since picking the preset, this goes false and the readout falls back
 * rather than trying to guess which district they meant.
 */
export function isHiddenSetForDistrict(
  hidden: Set<string>,
  rows: CsaRow[],
  district: CouncilDistrict,
): boolean {
  const expected = buildHiddenForDistrict(rows, district);
  if (expected.size !== hidden.size) {
    return false;
  }
  for (const label of expected) {
    if (!hidden.has(label)) {
      return false;
    }
  }
  return true;
}
