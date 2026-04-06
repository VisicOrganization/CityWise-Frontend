/** Delay between Nominatim requests (~1/s) per https://operations.osmfoundation.org/policies/nominatim/ */
export const NOMINATIM_REQUEST_INTERVAL_MS =
  typeof import.meta !== "undefined" && import.meta.env?.MODE === "test" ? 0 : 1100;

export function buildGeocodeQuery(street: string): string {
  const trimmed = street.trim();
  if (!trimmed) {
    return "";
  }
  return `${trimmed}, Los Angeles, CA, USA`;
}

/**
 * Geocode a street address string to coordinates using Nominatim (first hit).
 * Callers should space calls with at least {@link NOMINATIM_REQUEST_INTERVAL_MS}.
 */
export async function geocodeStreetAddress(street: string): Promise<{ latitude: number; longitude: number } | null> {
  const q = buildGeocodeQuery(street);
  if (!q) {
    return null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = payload[0];
  if (!first) {
    return null;
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
