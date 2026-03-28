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


export const demoDistrict: DemoDistrict = {
  id: 12,
  label: "District 12",
  representative: "John Lee",
};

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
