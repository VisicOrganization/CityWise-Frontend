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
  kind?: "base" | "search";
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

export const demoMapMarkers: DemoMapMarker[] = [
  {
    id: "porter-ranch-park",
    category: "parks",
    label: "Porter Ranch Community Park",
    longitude: -118.565,
    latitude: 34.277,
    kind: "base",
  },
  {
    id: "metrolink",
    category: "transit",
    label: "Chatsworth Metrolink Station",
    longitude: -118.6005,
    latitude: 34.2535,
    kind: "base",
  },
  {
    id: "mar-vista",
    category: "housing",
    label: "Mar Vista Green Streets",
    longitude: -118.611,
    latitude: 34.242,
    kind: "base",
  },
  {
    id: "library",
    category: "housing",
    label: "Pacific Palisades Library Addition",
    longitude: -118.585,
    latitude: 34.183,
    kind: "base",
  },
  {
    id: "arts-gateway",
    category: "housing",
    label: "Boyle Heights Arts District Gateway",
    longitude: -118.554,
    latitude: 34.205,
    kind: "base",
  },
  {
    id: "watts-center",
    category: "parks",
    label: "Watts Community Center Expansion",
    longitude: -118.539,
    latitude: 34.191,
    kind: "base",
  },
  {
    id: "cesar-chavez",
    category: "transit",
    label: "Cesar Chavez Avenue",
    longitude: -118.589,
    latitude: 34.201,
    kind: "base",
  },
];

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
