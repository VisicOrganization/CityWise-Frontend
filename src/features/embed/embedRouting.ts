import { getDistrictAssetSource } from "../map/cd2Assets";

/**
 * Route-parameter resolution for `/embed/v1/:districtSlug/:neighborhoodSlug?`.
 *
 * Kept dependency-free of React so it can be unit tested without rendering MapLibre (which
 * jsdom cannot do). `EmbedPage` is the only caller.
 */

/**
 * "cd2" -> 2, "cd15" -> 15. Trailing digits rather than a hardcoded "cd" + number pair, so a
 * future district slug doesn't require touching this parser -- only the registry in
 * `cd2Assets.ts` needs a new entry.
 *
 * `null` for anything with no trailing digits at all (no district), which is distinct from a
 * syntactically valid slug for a district the registry doesn't have data for -- see
 * `isKnownDistrict`.
 */
export function parseDistrictId(districtSlug: string | undefined): number | null {
  if (!districtSlug) {
    return null;
  }
  const match = districtSlug.trim().match(/(\d+)\s*$/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Whether the district registry (`cd2Assets.ts`) has data for this id. */
export function isKnownDistrict(districtId: number | null): districtId is number {
  return districtId !== null && getDistrictAssetSource(districtId) !== null;
}
