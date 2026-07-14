/** Mirrors the `ck_projects_category` CHECK constraint in the backend schema. */
export const MARKER_CATEGORIES = [
  "Housing",
  "Education",
  "Infrastructure",
  "Public Resources",
  "Equity & Community Works",
  "Environmental",
  "Public Safety",
  "Economic",
  "Miscellaneous",
] as const;

export type MarkerCategory = (typeof MARKER_CATEGORIES)[number];

/** Category for projects the backend left unclassified, or classified outside the known set. */
export const FALLBACK_MARKER_CATEGORY: MarkerCategory = "Miscellaneous";

export function isMarkerCategory(value: string): value is MarkerCategory {
  return (MARKER_CATEGORIES as readonly string[]).includes(value);
}

/** Fill color baked into each pin SVG; also the accent color for that category elsewhere in the UI. */
export const CATEGORY_COLOR: Record<MarkerCategory, string> = {
  "Housing": "#00918A",
  "Education": "#A453F1",
  "Infrastructure": "#E67E22",
  "Public Resources": "#3779F4",
  "Equity & Community Works": "#D8B414",
  "Environmental": "#00AE6D",
  "Public Safety": "#F44848",
  "Economic": "#FF57CA",
  "Miscellaneous": "#8D6E63",
};

/** Resolves a raw backend category string to a known category, falling back for null/unknown values. */
export function toMarkerCategory(value: string | null | undefined): MarkerCategory {
  const trimmed = value?.trim() ?? "";
  return isMarkerCategory(trimmed) ? trimmed : FALLBACK_MARKER_CATEGORY;
}

export interface MapMarker {
  id: string;
  category: MarkerCategory;
  label: string;
  /** Project description text for the map hover card (from project card summary). */
  summary: string;
  longitude: number;
  latitude: number;
  districtId: number | null;
  projectId: string | null;
  kind: "project";
}
