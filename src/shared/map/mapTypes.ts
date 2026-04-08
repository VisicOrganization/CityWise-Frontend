export type MarkerCategory = "housing" | "transit" | "parks";

export interface MapMarker {
  id: string;
  category: MarkerCategory;
  label: string;
  longitude: number;
  latitude: number;
  districtId: number | null;
  projectId: string | null;
  kind: "project" | "search";
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
