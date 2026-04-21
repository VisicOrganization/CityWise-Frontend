import { findDistrictIdForPoint, loadDistrictBoundaries } from "./districtBoundaries";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:18100";

function nominatimSearchEndpoint(): string {
  return `${API_BASE_URL.trim().replace(/\/$/, "")}/nominatim/search`;
}

function buildNominatimSearchUrl(trimmedQuery: string): URL {
  const url = new URL(nominatimSearchEndpoint());
  url.searchParams.set("q", trimmedQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "4");
  return url;
}

export interface GeocodeSearchResult {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
}

const LOS_ANGELES_IN_LABEL = /\blos\s+angeles\b/i;

export function geocodeResultLabelIncludesLosAngeles(result: GeocodeSearchResult): boolean {
  return LOS_ANGELES_IN_LABEL.test(result.label);
}

function filterSuggestionsToLosAngelesName(results: GeocodeSearchResult[]): GeocodeSearchResult[] {
  return results.filter(geocodeResultLabelIncludesLosAngeles);
}

let districtBoundariesPromise: ReturnType<typeof loadDistrictBoundaries> | null = null;

async function loadDistrictBoundariesOnce() {
  if (!districtBoundariesPromise) {
    districtBoundariesPromise = loadDistrictBoundaries();
  }
  return districtBoundariesPromise;
}

async function searchNominatim(query: string): Promise<GeocodeSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const url = buildNominatimSearchUrl(trimmedQuery);

  const response = await fetch(url.toString(), {
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

export async function isAddressWithinLosAngelesCity(result: GeocodeSearchResult): Promise<boolean> {
  const districtBoundaries = await loadDistrictBoundariesOnce();
  return findDistrictIdForPoint(districtBoundaries, result.longitude, result.latitude) !== null;
}

export async function searchAddressesWithoutCityFilter(query: string): Promise<GeocodeSearchResult[]> {
  return searchNominatim(query);
}

async function filterGeocodeResultsToLosAngelesCity(results: GeocodeSearchResult[]): Promise<GeocodeSearchResult[]> {
  if (results.length === 0) {
    return [];
  }
  const districtBoundaries = await loadDistrictBoundariesOnce();
  return results.filter(
    (result) => findDistrictIdForPoint(districtBoundaries, result.longitude, result.latitude) !== null,
  );
}

/** Nominatim hits plus those that fall inside City of LA council boundaries (same order as Nominatim). */
export async function searchAddressesWithLosAngelesCitySplit(query: string): Promise<{
  inLosAngelesCity: GeocodeSearchResult[];
  nominatimHitCount: number;
  /** Suggestion UI: Nominatim hits whose display name includes Los Angeles, in original order. */
  nominatimResults: GeocodeSearchResult[];
}> {
  const rawNominatim = await searchNominatim(query);
  const nominatimResults = filterSuggestionsToLosAngelesName(rawNominatim);
  const inLosAngelesCity = await filterGeocodeResultsToLosAngelesCity(nominatimResults);
  return {
    inLosAngelesCity,
    nominatimHitCount: rawNominatim.length,
    nominatimResults,
  };
}

export async function searchAddresses(query: string): Promise<GeocodeSearchResult[]> {
  const { inLosAngelesCity } = await searchAddressesWithLosAngelesCitySplit(query);
  return inLosAngelesCity;
}
