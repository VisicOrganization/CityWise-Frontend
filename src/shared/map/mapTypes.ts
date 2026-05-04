export type MarkerCategory = "housing" | "transit" | "parks";

/** Display label for map hover and other UI (matches ProjectDetailsPanel base category). */
export function markerCategoryLabel(category: MarkerCategory): string {
  if (category === "housing") {
    return "Housing";
  }
  if (category === "transit") {
    return "Transportation";
  }
  return "Infrastructure";
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

export const categoryAppearance = {
  housing: {
    icon: "⌂",
    className: "marker-housing",
  },
  transit: {
    icon: "🚌",
    className: "marker-transit",
  },
  parks: {
    icon: "♣",
    className: "marker-parks",
  },
} as const;
