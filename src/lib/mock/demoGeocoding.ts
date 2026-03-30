import type { DemoMapMarker } from "./mapDemo";


export interface DemoGeocodeResult {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
}


function categoryFromQuery(query: string): DemoMapMarker["category"] {
  const categories: DemoMapMarker["category"][] = ["housing", "transit", "parks"];
  const score = Array.from(query).reduce((total, char) => total + char.charCodeAt(0), 0);
  return categories[score % categories.length];
}


export async function searchDemoAddresses(query: string): Promise<DemoGeocodeResult[]> {
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


export function buildDemoMarkerFromSearch(result: DemoGeocodeResult, query: string): DemoMapMarker {
  return {
    id: `search-${result.id}`,
    category: categoryFromQuery(query),
    label: result.label.split(",")[0] || query,
    longitude: result.longitude,
    latitude: result.latitude,
    districtId: null,
    projectId: null,
    kind: "search",
  };
}
