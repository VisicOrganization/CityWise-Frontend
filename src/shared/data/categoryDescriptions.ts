import type { MarkerCategory } from "../map/mapTypes";
import raw from "./categoryDescriptions.json";

/** Typed as a full Record, so a category missing from the JSON fails the build rather than at runtime. */
const CATEGORY_DESCRIPTION: Record<MarkerCategory, { description: string }> = raw;

export function categoryDescription(category: MarkerCategory): string {
  return CATEGORY_DESCRIPTION[category].description;
}
