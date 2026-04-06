import type { MapMarker } from "./mapTypes";


export interface GeocodeSearchResult {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
}

const SEARCH_MARKER_CATEGORY: MapMarker["category"] = "housing";

export async function searchAddresses(query: string): Promise<GeocodeSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "4");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to geocode that search right now.");
  }

  const payload = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return payload.map((result) => ({
    id: String(result.place_id),
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  }));
}

export function buildSearchMarker(result: GeocodeSearchResult, query: string): MapMarker {
  return {
    id: `search-${result.id}`,
    category: SEARCH_MARKER_CATEGORY,
    label: result.label.split(",")[0] || query,
    longitude: result.longitude,
    latitude: result.latitude,
    districtId: null,
    projectId: null,
    kind: "search",
  };
}
