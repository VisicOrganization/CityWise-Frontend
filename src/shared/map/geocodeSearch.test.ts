import { afterEach, describe, expect, it, vi } from "vitest";

import { searchAddressesWithoutCityFilter } from "./geocodeSearch";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("geocodeSearch", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("routes geocoding through VITE_API_BASE_URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:18100");
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            place_id: 1,
            display_name: "123 Main St, Los Angeles, California, United States",
            lat: "34.0500",
            lon: "-118.2500",
          },
        ]),
      ),
    );

    await searchAddressesWithoutCityFilter("123 Main St");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.origin).toBe("http://localhost:18100");
    expect(requestUrl.pathname).toBe("/nominatim/search");
    expect(requestUrl.searchParams.get("q")).toBe("123 Main St");
    expect(requestUrl.searchParams.get("format")).toBe("jsonv2");
    expect(requestUrl.searchParams.get("limit")).toBe("4");
  });

  it("uses the shared backend default when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    fetchMock.mockResolvedValue(new Response(JSON.stringify([])));

    await searchAddressesWithoutCityFilter("test");

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.origin).toBe("http://localhost:18100");
    expect(requestUrl.pathname).toBe("/nominatim/search");
  });
});
