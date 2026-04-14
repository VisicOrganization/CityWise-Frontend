export type MarkerCategory = "housing" | "transit" | "parks";

export interface MapMarker {
  id: string;
  category: MarkerCategory;
  label: string;
  /** Short description for map hover card (from project card summary). */
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
