export interface DemoDistrict {
  id: number;
  label: string;
  representative: string;
}


export interface DemoMapMarker {
  id: string;
  category: "housing" | "transit" | "parks";
  label: string;
  longitude: number;
  latitude: number;
  districtId: number | null;
  projectId: string | null;
  kind: "project" | "search";
}


export const demoDistricts: Record<number, DemoDistrict> = {
  1: { id: 1, label: "District 1", representative: "Elena Torres" },
  2: { id: 2, label: "District 2", representative: "Marcus Reed" },
  3: { id: 3, label: "District 3", representative: "Priya Shah" },
  4: { id: 4, label: "District 4", representative: "Noah Kim" },
  5: { id: 5, label: "District 5", representative: "Camila Flores" },
  6: { id: 6, label: "District 6", representative: "Andre Bennett" },
  7: { id: 7, label: "District 7", representative: "Sofia Morales" },
  8: { id: 8, label: "District 8", representative: "Isaiah Coleman" },
  9: { id: 9, label: "District 9", representative: "Leah Brooks" },
  10: { id: 10, label: "District 10", representative: "Maya Patel" },
  11: { id: 11, label: "District 11", representative: "Jordan Alvarez" },
  12: { id: 12, label: "District 12", representative: "John Lee" },
  13: { id: 13, label: "District 13", representative: "Nina Park" },
  14: { id: 14, label: "District 14", representative: "Daniel Vargas" },
  15: { id: 15, label: "District 15", representative: "Avery Sutton" },
};

export const demoDistrict = demoDistricts[12];

export function getDemoDistrict(districtId: number | null | undefined): DemoDistrict {
  if (!districtId) {
    return demoDistrict;
  }

  return demoDistricts[districtId] ?? {
    id: districtId,
    label: `District ${districtId}`,
    representative: "CityWise Demo Rep",
  };
}

export const landingPrompts = [
  { id: "district", label: "What district am I in?", tone: "sky" },
  { id: "member", label: "Who is my council member?", tone: "slate" },
  { id: "activity", label: "What's happening in my district?", tone: "mint" },
] as const;

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
