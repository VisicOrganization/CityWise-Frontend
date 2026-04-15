import { afterEach, describe, expect, it, vi } from "vitest";

import { getDistrictProjects, getProjectDetail } from "./client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("api client", () => {
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
    expect(response.items[0]?.url).toBe("https://cityclerk.lacity.org/council-file/25-0358");
    expect(response.items[0]?.address_info?.geocode).toEqual({
      latitude: 34.05,
      longitude: -118.25,
      provider: "census",
    });
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
});
