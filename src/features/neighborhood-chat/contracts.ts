import type { AssetCollection, PanelAsset } from "../map/cd2Assets";

export type ResourceType =
  | "parks"
  | "police"
  | "fire"
  | "libraries"
  | "neighborhood_councils"
  | "community"
  | "business"
  | "markets"
  | "arts"
  | "housing"
  | "district_office"
  | "transport"
  | "all";

export type NeighborhoodAction =
  | "find"
  | "nearest"
  | "details"
  | "clarify"
  | "unsupported"
  | "out_of_scope";

export interface NeighborhoodIntent {
  action: NeighborhoodAction;
  resource_type: ResourceType | null;
  resource_name: string | null;
  neighborhood: string | null;
  field:
    | "address"
    | "phone"
    | "email"
    | "website"
    | "meeting_information"
    | "serves"
    | "location"
    | null;
}

export interface ResourceResolution {
  answer: string;
  items: PanelAsset[];
  distances: Record<string, number>;
  needs: "point" | "resource" | "query" | null;
}

export type Origin = { longitude: number; latitude: number };
export type Resolution = ResourceResolution;

export type { AssetCollection, PanelAsset };
