import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../app/App";
import { clearApiCacheForTests } from "../../shared/api/client";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { resetCouncilMemberBiosCacheForTests } from "../districts/useCouncilMemberBios";
import { resetMapDataCacheForTests } from "./useMapData";


vi.mock("react-map-gl/maplibre", () => ({
  default: React.forwardRef(function MockMap(
    { children, onClick }: { children?: ReactNode; onClick?: (event: unknown) => void },
    ref: React.ForwardedRef<{ getMap: () => { getZoom: () => number; easeTo: () => void; jumpTo: () => void } } | null>,
  ) {
    React.useImperativeHandle(ref, () => ({
      getMap: () => ({
        getZoom: () => 10,
        easeTo: vi.fn(),
        jumpTo: vi.fn(),
        fitBounds: vi.fn(),
      }),
    }));
    return (
      <div data-testid="demo-map">
        <button
          type="button"
          data-testid="mock-boundary-click"
          onClick={() =>
            onClick?.({
              features: [
                {
                  properties: {
                    District: 11,
                  },
                },
              ],
            })
          }
        >
          mock boundary click
        </button>
        <button
          type="button"
          data-testid="mock-empty-map-click"
          onClick={() =>
            onClick?.({
              features: [],
            })
          }
        >
          mock empty click
        </button>
        {children}
      </div>
    );
  }),
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children, id }: { children?: ReactNode; id?: string }) => (
    <div data-testid={id === "district-boundaries" ? "mock-boundary-source" : undefined}>{children}</div>
  ),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const boundariesResponse = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        District: 11,
        District_Name: "Council District 11",
        NAME: "District 11",
        NLA_URL: "",
        OBJECTID: 11,
        TOOLTIP: "District 11",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-118.6, 34.1],
          [-118.5, 34.1],
          [-118.5, 34.2],
          [-118.6, 34.2],
          [-118.6, 34.1],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        District: 12,
        District_Name: "Council District 12",
        NAME: "District 12",
        NLA_URL: "",
        OBJECTID: 12,
        TOOLTIP: "District 12",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-118.7, 34.2],
          [-118.58, 34.2],
          [-118.58, 34.3],
          [-118.7, 34.3],
          [-118.7, 34.2],
        ]],
      },
    },
  ],
};

const districtProjectsResponseByDistrict = {
  11: {
    district_id: 11,
    page: 1,
    page_size: 100,
    total: 2,
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
        secondary_movers: ["HEATHER HUTT"],
        document_count: 2,
        primary_address: null,
        address_info: {
          project_title: "Council File 25-0358",
          primary_address: "100 First St",
          addresses: ["100 First St"],
          places: [],
          topics: [],
          segments: [],
          geocode: {
            latitude: 34.0501,
            longitude: -118.4501,
            provider: "backend",
          },
        },
      },
      {
        id: "25-0400",
        url: null,
        title: "Council File 25-0400",
        summary: "Transit corridor updates.",
        status: "in progress",
        district_id: 11,
        last_changed_date: "2025-04-12",
        start_date: "2025-04-08",
        meeting_date: "2025-04-12",
        primary_movers: ["TRACI PARK"],
        secondary_movers: [],
        document_count: 1,
        primary_address: "200 Second St",
        address_info: {
          project_title: "Council File 25-0400",
          primary_address: "200 Second St",
          addresses: ["200 Second St"],
          places: [],
          topics: [],
          segments: [],
          geocode: {
            latitude: 34.0602,
            longitude: -118.4602,
            provider: "backend",
          },
        },
      },
    ],
  },
  12: {
    district_id: 12,
    page: 1,
    page_size: 100,
    total: 1,
    total_pages: 1,
    items: [
      {
        id: "25-0501",
        url: "https://cityclerk.lacity.org/council-file/25-0501",
        title: "Council File 25-0501",
        summary: "Community park expansion.",
        status: "planned",
        district_id: 12,
        last_changed_date: "2025-04-14",
        start_date: "2025-04-10",
        meeting_date: "2025-04-14",
        primary_movers: ["JOHN LEE"],
        secondary_movers: [],
        document_count: 1,
        primary_address: "300 Third St",
        address_info: {
          project_title: "Council File 25-0501",
          primary_address: "300 Third St",
          addresses: ["300 Third St"],
          places: [],
          topics: [],
          segments: [],
          geocode: {
            latitude: 34.0703,
            longitude: -118.4703,
            provider: "backend",
          },
        },
      },
    ],
  },
} as const;

function buildEmptyDistrictResponse(districtId: number) {
  return {
    district_id: districtId,
    page: 1,
    page_size: 100,
    total: 0,
    total_pages: 0,
    items: [],
  };
}

function defaultFetchMock(input: string | URL | Request) {
  const url = String(input);
  const requestUrl = new URL(url, "http://localhost");
  const pathname = requestUrl.pathname;

  if (pathname === "/nominatim/search") {
    return Promise.resolve(
      new Response(
        JSON.stringify([
          {
            place_id: 1,
            display_name: "Mock, Los Angeles, California, United States",
            lat: "34.0500",
            lon: "-118.2500",
          },
        ]),
      ),
    );
  }

  if (url.includes("la-city-council-districts.geojson")) {
    return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
  }

  if (pathname === "/districts") {
    return Promise.resolve(new Response(JSON.stringify({ district_ids: [11, 12] })));
  }

  if (pathname === "/council-members") {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 1,
              district_id: 11,
              name: "Jordan Alvarez",
              first_name: null,
              last_name: null,
              email: "jordan.alvarez.bios@lacity.org",
              phone_number: "(213) 473-7011",
              website: "https://cd11.lacity.gov/",
              about: "Council member bio from static data file.",
              impact_summary: null,
              profile_pic: null,
              is_active: "Y",
            },
          ],
        }),
      ),
    );
  }

  const profileMatch = pathname.match(/^\/districts\/(\d+)$/);
  if (profileMatch) {
    const id = Number(profileMatch[1]);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 100 + id,
          district_id: id,
          name: id === 11 ? "Jordan Alvarez" : `Council Member ${id}`,
          first_name: null,
          last_name: null,
          email: null,
          website: `https://cd${id}.lacity.gov/`,
          phone_number: "(213) 473-7011",
          about: "About this district representative.",
          impact_summary: "Housing and transportation priorities.",
          profile_pic: null,
          is_active: "Y",
        }),
      ),
    );
  }

  const districtMatch = url.match(/\/districts\/(\d+)\/projects/);
  if (districtMatch) {
    const requestUrl = new URL(url, "http://localhost");
    expect(requestUrl.searchParams.get("has_geocode")).toBe("true");
    const districtId = Number(districtMatch[1]);
    const payload =
      districtProjectsResponseByDistrict[districtId as keyof typeof districtProjectsResponseByDistrict] ??
      buildEmptyDistrictResponse(districtId);
    return Promise.resolve(new Response(JSON.stringify(payload)));
  }

  const projectDetailMatch = pathname.match(/^\/projects\/(.+)$/);
  if (projectDetailMatch) {
    const projectId = projectDetailMatch[1];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          project: {
            id: projectId,
            source_council_file_id: projectId,
            url: `https://cityclerk.lacity.org/council-file/${projectId}`,
            title: `Council File ${projectId}`,
            summary: "Mock summary for tests.",
            status: "planned",
            district_id: 11,
            about: null,
            start_date: "2025-04-04",
            last_changed_date: "2025-04-11",
            end_date: null,
            meeting_date: null,
            meeting_type: null,
            vote_action: null,
            vote_given: null,
            reference_numbers: null,
            mover_seconder_comment: null,
          },
          movers: { primary: [], secondary: [], other: [] },
          votes: [],
          timeline: [],
          documents:
            projectId === "25-0358"
              ? [
                  {
                    url: "https://example.com/cf.pdf",
                    title: "CF PDF",
                    date: "2025-04-04",
                    source: "test",
                  },
                ]
              : [],
          address_info: null,
        }),
      ),
    );
  }

  return Promise.reject(new Error(`Unhandled fetch for ${url}`));
}


describe("mock app routes", () => {
  beforeEach(() => {
    clearApiCacheForTests();
    resetMapDataCacheForTests();
    resetCouncilMemberBiosCacheForTests();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultFetchMock);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the landing page as the entry point", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const requestUrl = new URL(String(input), "http://localhost");

      if (requestUrl.pathname === "/nominatim/search") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                place_id: 3,
                display_name: "123 Main St, Los Angeles, California, United States",
                lat: "34.1500",
                lon: "-118.5200",
              },
            ]),
          ),
        );
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Visualize Your Council District's Impact")).toBeInTheDocument();
    const input = screen.getByLabelText("Search address");
    await user.type(input, "123 Main St");
    expect(input).toHaveValue("123 Main St");
    expect(
      await screen.findByRole("option", { name: "123 Main St, Los Angeles, California, United States" }),
    ).toBeInTheDocument();
  });

  it("submits the landing search on Enter", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const requestUrl = new URL(String(input), "http://localhost");
      if (requestUrl.pathname === "/nominatim/search") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                place_id: 3,
                display_name: "456 Sunset Blvd, Los Angeles, California, United States",
                lat: "34.1500",
                lon: "-118.5500",
              },
            ]),
          ),
        );
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search address");
    await user.type(input, "456 Sunset Blvd{Enter}");

    expect(screen.queryByLabelText("Search query")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("District overview")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open Map" })).toBeInTheDocument();
  });

  it("renders the general map-only mock screen", async () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("demo-map")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Open District .* overview/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search query")).not.toBeInTheDocument();
    await screen.findByTestId("mock-boundary-source");
  });

  it("renders district boundaries before the district project preload finishes", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      const pathname = new URL(url, "http://localhost").pathname;

      if (url.includes("la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      if (pathname === "/districts") {
        return Promise.resolve(new Response(JSON.stringify({ district_ids: [11, 12] })));
      }

      if (pathname === "/council-members") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: 1,
                  district_id: 11,
                  name: "Jordan Alvarez",
                  first_name: null,
                  last_name: null,
                  email: "jordan.alvarez.bios@lacity.org",
                  phone_number: "(213) 473-7011",
                  website: "https://cd11.lacity.gov/",
                  about: "Council member bio from static data file.",
                  impact_summary: null,
                  profile_pic: null,
                  is_active: "Y",
                },
              ],
            }),
          ),
        );
      }

      if (pathname.match(/^\/districts\/(\d+)$/)) {
        const id = Number(pathname.match(/^\/districts\/(\d+)$/)?.[1]);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 111,
              district_id: id,
              name: "Jordan Alvarez",
              first_name: null,
              last_name: null,
              email: null,
              website: null,
              phone_number: null,
              about: null,
              impact_summary: null,
              profile_pic: null,
              is_active: "Y",
            }),
          ),
        );
      }

      if (url.match(/\/districts\/(\d+)\/projects/)) {
        return new Promise(() => {});
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("mock-boundary-source")).toBeInTheDocument();
    expect(screen.getByTestId("demo-map")).toBeInTheDocument();
  });

  it("uses backend geocode coordinates for project markers without client-side geocoding", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const requestUrl = new URL(String(input), "http://localhost");

      if (requestUrl.pathname === "/nominatim/search") {
        return Promise.reject(new Error("project markers should not geocode on the client"));
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Council File 25-0358")).toBeInTheDocument();
    expect(screen.getByLabelText("Council File 25-0400")).toBeInTheDocument();
    expect(screen.getByLabelText("Council File 25-0501")).toBeInTheDocument();

    const projectListRequests = fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((requestUrl) => /^\/districts\/\d+\/projects$/.test(requestUrl.pathname));
    expect(projectListRequests.length).toBeGreaterThan(0);
    expect(projectListRequests.every((requestUrl) => requestUrl.searchParams.get("has_geocode") === "true")).toBe(
      true,
    );
    expect(
      projectListRequests.every((requestUrl) => requestUrl.searchParams.get("boundary_filter") === "citywide"),
    ).toBe(true);
  });

  it("updates the district pill when a project pin is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/Open District .* overview/)).not.toBeInTheDocument();
    await user.click(await screen.findByLabelText("Council File 25-0358"));
    expect(screen.getByLabelText("Open District 11 overview")).toBeInTheDocument();
    expect(screen.getByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );
  });

  it("updates the district pill when a district boundary is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/Open District .* overview/)).not.toBeInTheDocument();
    await user.click(screen.getByTestId("mock-boundary-click"));
    expect(await screen.findByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );
  });

  it("keeps the district pill when the map is clicked outside district boundaries", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText("Council File 25-0358"));
    expect(await screen.findByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );

    await user.click(screen.getByTestId("mock-empty-map-click"));

    expect(screen.getByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );
    expect(screen.queryByText("Select a district")).not.toBeInTheDocument();
  });

  it("closes the project details panel when the map background is clicked", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/projects/25-0358")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project: {
                id: "25-0358",
                source_council_file_id: "25-0358",
                url: "https://cityclerk.lacity.org/council-file/25-0358",
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
                vote_action: "Adopted Forthwith",
                vote_given: "(15 - 0 - 0)",
                reference_numbers: null,
                mover_seconder_comment: "Wildfire recovery motion.",
              },
              movers: {
                primary: [{ id: 7, name: "TRACI PARK", district_id: 11 }],
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
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText("Council File 25-0358"));
    expect(await screen.findByLabelText("Project details")).toBeInTheDocument();

    await user.click(screen.getByTestId("mock-empty-map-click"));

    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    randomSpy.mockRestore();
  });

  it("closes the project details panel when a district boundary is clicked", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/projects/25-0358")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project: {
                id: "25-0358",
                source_council_file_id: "25-0358",
                url: "https://cityclerk.lacity.org/council-file/25-0358",
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
                vote_action: "Adopted Forthwith",
                vote_given: "(15 - 0 - 0)",
                reference_numbers: null,
                mover_seconder_comment: "Wildfire recovery motion.",
              },
              movers: {
                primary: [{ id: 7, name: "TRACI PARK", district_id: 11 }],
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
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText("Council File 25-0358"));
    expect(await screen.findByLabelText("Project details")).toBeInTheDocument();

    await user.click(screen.getByTestId("mock-boundary-click"));

    expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );
    randomSpy.mockRestore();
  });

  it("opens the selected district overview from the pill", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText("Council File 25-0358"));
    await user.click(screen.getByLabelText("Open District 11 overview"));

    expect(await screen.findByRole("heading", { name: "Jordan Alvarez • District 11" })).toBeInTheDocument();
    expect(await screen.findByText("https://cd11.lacity.gov/")).toBeInTheDocument();
    expect(await screen.findByText("Council member bio from static data file.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jordan.alvarez.bios@lacity.org" })).toHaveAttribute(
      "href",
      "mailto:jordan.alvarez.bios@lacity.org",
    );
    const projectLinks = screen.getAllByLabelText("Open project document in new tab");
    expect(projectLinks).toHaveLength(1);
    expect(projectLinks[0]).toHaveAttribute("href", "https://cityclerk.lacity.org/council-file/25-0358");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/projects/"))).toHaveLength(1);
    expect(screen.queryByTestId("demo-map")).toBeInTheDocument();
  });

  it("loads district overview links from district project cards without per-project detail fetches", async () => {
    render(
      <MemoryRouter initialEntries={["/map?districtFocus=11&showDistrictProfile=1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("District overview")).toBeInTheDocument();
    const projectLinks = await screen.findAllByLabelText("Open project document in new tab");
    expect(projectLinks).toHaveLength(1);
    expect(projectLinks[0]).toHaveAttribute("href", "https://cityclerk.lacity.org/council-file/25-0358");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/projects/"))).toHaveLength(0);
  });

  it("closes the district overview when clicking outside the sheet", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map?districtFocus=11"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("District overview")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Close district overview"));
    expect(screen.queryByLabelText("District overview")).not.toBeInTheDocument();
  });

  it("closes district profile via Open Map while keeping district context", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map?districtFocus=11&showDistrictProfile=1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("District overview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Map" }));
    expect(screen.queryByLabelText("District overview")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Open District 11 overview")).toBeInTheDocument();
    expect(screen.getByLabelText("Open District 11 overview")).toHaveTextContent(
      /jordan\s+alvarez\s*•\s*district\s+11/i,
    );
  });

  it("opens the accessibility menu", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Toggle accessibility information"));
    const info = screen.getByLabelText("Accessibility information");
    expect(info).toBeInTheDocument();
    expect(within(info).getByText("Accessibility")).toBeInTheDocument();
  });

  it("opens the details panel with backend project data when a marker is clicked", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/projects/25-0358")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project: {
                id: "25-0358",
                source_council_file_id: "25-0358",
                url: "https://cityclerk.lacity.org/council-file/25-0358",
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
                vote_action: "Adopted Forthwith",
                vote_given: "(15 - 0 - 0)",
                reference_numbers: null,
                mover_seconder_comment: "Wildfire recovery motion.",
              },
              movers: {
                primary: [{ id: 7, name: "TRACI PARK", district_id: 11 }],
                secondary: [{ id: 8, name: "HEATHER HUTT", district_id: 10 }],
                other: [],
              },
              votes: [
                {
                  member: { id: 7, name: "TRACI PARK", district_id: 11 },
                  vote: "YES",
                },
              ],
              timeline: [
                {
                  date: "2025-04-04",
                  type: "file_activity",
                  text: "Motion introduced.",
                  documents: [
                    {
                      url: "https://example.com/motion.pdf",
                      title: "Motion PDF",
                      date: "2025-04-04",
                    },
                  ],
                },
              ],
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
      }

      return defaultFetchMock(input);
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Council File 25-0358")).toBeInTheDocument();
    expect(screen.getByLabelText("Council File 25-0400")).toBeInTheDocument();
    expect(screen.getByLabelText("Council File 25-0501")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Council File 25-0358"));

    expect(await screen.findByLabelText("Project details")).toBeInTheDocument();
    expect(screen.getByLabelText("Open primary project document in a new tab")).toHaveAttribute(
      "href",
      "https://cityclerk.lacity.org/council-file/25-0358",
    );
    expect(
      await screen.findByText(
        `${formatPersonNameForDisplay("TRACI PARK")} (Primary), ${formatPersonNameForDisplay("HEATHER HUTT")} (Secondary)`,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open expanded timeline overview/i }));
    const motionNodes = await screen.findAllByText("Motion introduced.");
    expect(motionNodes.length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByLabelText("Toggle voting record"));
    expect(await screen.findByRole("dialog", { name: /Voting record/i })).toBeInTheDocument();
    expect(await screen.findByText("Yes")).toBeInTheDocument();

    randomSpy.mockRestore();
  });
});
