import { afterEach, describe, expect, it, vi } from "vitest";

import { clearApiCacheForTests, fetchCouncilMembers, getDistrictProjects, getProjectDetail } from "./client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
  clearApiCacheForTests();
});

describe("api client", () => {
  describe("VITE_PROJECTS_API_BASE_URL", () => {
    const original = process.env.VITE_PROJECTS_API_BASE_URL;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.VITE_PROJECTS_API_BASE_URL;
      } else {
        process.env.VITE_PROJECTS_API_BASE_URL = original;
      }
    });

    function emptyProjectsResponse() {
      return new Response(
        JSON.stringify({ district_id: 2, page: 1, page_size: 1, total: 0, total_pages: 0, items: [] }),
      );
    }

    it("reads project pins and detail from the override host, not the app's own API base", async () => {
      process.env.VITE_PROJECTS_API_BASE_URL = "https://projects.example.test";
      fetchMock.mockImplementation(() => Promise.resolve(emptyProjectsResponse()));
      await getDistrictProjects(2, 1, 1);
      expect(String(fetchMock.mock.calls[0][0])).toContain("https://projects.example.test/districts/2/projects");

      fetchMock.mockResolvedValue(new Response(JSON.stringify({ project: { id: "25-0677" } })));
      await getProjectDetail("25-0677");
      expect(String(fetchMock.mock.calls[1][0])).toBe("https://projects.example.test/projects/25-0677");
    });

    it("falls back to the app's API base when the override is unset", async () => {
      delete process.env.VITE_PROJECTS_API_BASE_URL;
      fetchMock.mockImplementation(() => Promise.resolve(emptyProjectsResponse()));
      await getDistrictProjects(2, 1, 1);
      expect(String(fetchMock.mock.calls[0][0])).toContain("http://localhost:18100/districts/2/projects");
    });

    it("does not serve one host's cached projects for another host", async () => {
      // The demo's local backend answers with zero projects; pointing at the deployed backend
      // afterwards must re-request rather than replay that empty list.
      delete process.env.VITE_PROJECTS_API_BASE_URL;
      // A fresh Response per call: a body can only be read once.
      fetchMock.mockImplementation(() => Promise.resolve(emptyProjectsResponse()));
      await getDistrictProjects(2, 1, 1);

      process.env.VITE_PROJECTS_API_BASE_URL = "https://projects.example.test";
      await getDistrictProjects(2, 1, 1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toContain("https://projects.example.test");
    });
  });

  it("requests district projects with has_geocode=true", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          district_id: 11,
          page: 2,
          page_size: 5,
          total: 1,
          total_pages: 1,
          items: [
            {
              id: "25-0358",
              url: "https://cityclerk.lacity.org/council-file/25-0358",
              title: "Council File 25-0358",
              summary: "Wildfire recovery motion.",
              status: "planned",
              district_id: 11,
              last_changed_date: "2025-04-11",
              start_date: "2025-04-04",
              meeting_date: "2025-04-11",
              primary_movers: ["TRACI PARK"],
              secondary_movers: [],
              document_count: 2,
              primary_address: "100 First St",
              address_info: {
                project_title: "Council File 25-0358",
                primary_address: "100 First St",
                addresses: ["100 First St"],
                places: [],
                topics: [],
                segments: [],
                geocode: {
                  latitude: 34.05,
                  longitude: -118.25,
                  provider: "census",
                },
              },
            },
          ],
        }),
      ),
    );

    const response = await getDistrictProjects(11, 2, 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/districts/11/projects");
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(requestUrl.searchParams.get("page_size")).toBe("5");
    expect(requestUrl.searchParams.get("has_geocode")).toBe("true");
    expect(requestUrl.searchParams.get("boundary_filter")).toBeNull();
    expect(response.items[0]?.url).toBe("https://cityclerk.lacity.org/council-file/25-0358");
    expect(response.items[0]?.address_info?.geocode).toEqual({
      latitude: 34.05,
      longitude: -118.25,
      provider: "census",
    });
  });

  it("requests citywide boundary filtering when requested", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          district_id: 11,
          page: 1,
          page_size: 100,
          total: 0,
          total_pages: 0,
          items: [],
        }),
      ),
    );

    await getDistrictProjects(11, 1, 100, { boundaryFilter: "citywide" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/districts/11/projects");
    expect(requestUrl.searchParams.get("has_geocode")).toBe("true");
    expect(requestUrl.searchParams.get("boundary_filter")).toBe("citywide");
  });

  it("caches district projects separately by boundary filter", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            district_id: 11,
            page: 1,
            page_size: 100,
            total: 0,
            total_pages: 0,
            items: [],
          }),
        ),
      ),
    );

    await getDistrictProjects(11, 1, 100);
    await getDistrictProjects(11, 1, 100, { boundaryFilter: "citywide" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const defaultRequestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const citywideRequestUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(defaultRequestUrl.searchParams.get("boundary_filter")).toBeNull();
    expect(citywideRequestUrl.searchParams.get("boundary_filter")).toBe("citywide");
  });

  it("accepts project detail responses where address_info.geocode is null", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: {
            id: "25-0358",
            source_council_file_id: "25-0358",
            url: null,
            title: "Council File 25-0358",
            summary: "Wildfire recovery motion.",
            status: "planned",
            district_id: 11,
            about: null,
            start_date: "2025-04-04",
            last_changed_date: "2025-04-11",
            end_date: null,
            meeting_date: "2025-04-11",
            meeting_type: "Regular",
            vote_action: null,
            vote_given: null,
            reference_numbers: null,
            mover_seconder_comment: null,
          },
          movers: {
            primary: [],
            secondary: [],
            other: [],
          },
          votes: [],
          timeline: [],
          documents: [],
          address_info: {
            project_title: "Council File 25-0358",
            primary_address: "100 First St",
            addresses: ["100 First St"],
            places: [],
            topics: [],
            segments: [],
            geocode: null,
          },
        }),
      ),
    );

    const response = await getProjectDetail("25-0358");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/projects/25-0358");
    expect(response.project.url).toBeNull();
    expect(response.address_info?.geocode).toBeNull();
  });

  it("caches project detail in local storage and reuses it", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: {
            id: "25-9999",
            source_council_file_id: "25-9999",
            url: "https://cityclerk.lacity.org/council-file/25-9999",
            title: "Council File 25-9999",
            summary: "Cached project detail response.",
            status: "planned",
            district_id: 11,
            about: null,
            start_date: "2025-01-01",
            last_changed_date: "2025-01-02",
            end_date: null,
            meeting_date: "2025-01-03",
            meeting_type: "Regular",
            vote_action: null,
            vote_given: null,
            reference_numbers: null,
            mover_seconder_comment: null,
          },
          movers: {
            primary: [],
            secondary: [],
            other: [],
          },
          votes: [],
          timeline: [],
          documents: [],
          address_info: null,
        }),
      ),
    );

    const firstResponse = await getProjectDetail("25-9999");
    const secondResponse = await getProjectDetail("25-9999");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(secondResponse).toEqual(firstResponse);
  });

  it("requests council members without is_active when using the default active filter", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] })));

    await fetchCouncilMembers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/council-members");
    expect(requestUrl.searchParams.has("is_active")).toBe(false);
  });

  it("requests council members with is_active=false when inactive members are requested", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] })));

    await fetchCouncilMembers({ isActive: false });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get("is_active")).toBe("false");
  });

  it("returns empty council members when the response is not OK", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));

    const result = await fetchCouncilMembers();

    expect(result.items).toEqual([]);
  });

  it("parses council members items from a successful response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 1,
              district_id: 11,
              name: "Ada Lovelace",
              first_name: null,
              last_name: null,
              email: null,
              phone_number: null,
              website: null,
              about: null,
              impact_summary: null,
              profile_pic: null,
              is_active: "Y",
            },
          ],
        }),
      ),
    );

    const result = await fetchCouncilMembers();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.district_id).toBe(11);
    expect(result.items[0]?.name).toBe("Ada Lovelace");
  });
});
