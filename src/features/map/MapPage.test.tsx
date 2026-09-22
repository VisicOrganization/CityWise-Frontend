import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../app/App";
import { interpretQuestion } from "../neighborhood-chat/client";
vi.mock("../neighborhood-chat/client", () => ({ interpretQuestion: vi.fn() }));
import { clearApiCacheForTests } from "../../shared/api/client";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { resetCouncilMemberBiosCacheForTests } from "../districts/useCouncilMemberBios";
import { resetMapDataCacheForTests } from "./useMapData";


/**
 * One stable map handle for the whole file, so a test can assert what the camera was asked to
 * do. The previous mock built a fresh object per getMap() call, which made easeTo unassertable.
 */
const mockMapContainer = { clientWidth: 1280 };
const mockMap = {
  getZoom: () => 10,
  easeTo: vi.fn(),
  jumpTo: vi.fn(),
  fitBounds: vi.fn(),
  getContainer: () => mockMapContainer,
};

/**
 * jsdom cannot rasterise an SVG (no canvas 2d context, and Image never fires load), so the real
 * icon registration can never resolve here. Only the hook is replaced; the icon ids, file paths
 * and layer specs stay real, and `assetPinImages.test.ts` covers the loader itself.
 */
vi.mock("./assetPinImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assetPinImages")>()),
  useAssetPinImages: () => true,
}));

vi.mock("react-map-gl/maplibre", () => ({
  default: React.forwardRef(function MockMap(
    {
      children,
      onClick,
      onMouseMove,
    }: {
      children?: ReactNode;
      onClick?: (event: unknown) => void;
      onMouseMove?: (event: unknown) => void;
    },
    ref: React.ForwardedRef<{ getMap: () => typeof mockMap } | null>,
  ) {
    React.useImperativeHandle(ref, () => ({ getMap: () => mockMap }));
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
          data-testid="mock-asset-hover"
          onClick={() =>
            onMouseMove?.({
              features: [
                {
                  layer: { id: "cd2-asset-points" },
                  properties: {
                    label: "Fire Station 60",
                    category: "PUBLIC SAFETY",
                    neighborhood: "Valley Village",
                  },
                },
              ],
              lngLat: { lng: -118.39, lat: 34.16 },
            })
          }
        >
          mock asset hover
        </button>
        <button
          type="button"
          data-testid="mock-asset-click"
          onClick={() =>
            onClick?.({
              features: [
                {
                  layer: { id: "cd2-asset-points" },
                  geometry: { type: "Point", coordinates: [-118.39, 34.16] },
                  properties: {
                    label: "Fire Station 60",
                    category: "PUBLIC SAFETY",
                    neighborhood: "Valley Village",
                  },
                },
              ],
            })
          }
        >
          mock asset click
        </button>
        <button
          type="button"
          data-testid="mock-district-asset-click"
          onClick={() =>
            onClick?.({
              features: [
                {
                  layer: { id: "cd2-asset-points" },
                  geometry: { type: "Point", coordinates: [-118.37, 34.15] },
                  properties: {
                    label: "Vineland Avenue Median",
                    category: "DISTRICT PROJECTS & OFFICE",
                    neighborhood: "Districtwide",
                  },
                },
              ],
            })
          }
        >
          mock district asset click
        </button>
        <button
          type="button"
          data-testid="mock-neighborhood-click"
          onClick={() =>
            onClick?.({
              features: [
                {
                  layer: { id: "cd2-neighborhood-fill" },
                  properties: { CSA_Label: "Los Angeles - Valley Village" },
                },
              ],
            })
          }
        >
          mock neighborhood click
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
  // The filter is surfaced because layers now mount unconditionally and turn themselves off
  // with a match-nothing filter, so presence alone no longer says whether one is active.
  Layer: ({ id, filter }: { id?: string; filter?: unknown }) => (
    <div
      data-testid={id ? `layer-${id}` : undefined}
      data-filter={filter === undefined ? undefined : JSON.stringify(filter)}
    />
  ),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // Only reached once a test clicks an asset pin: the overlay opens its click card there.
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
        category: "Housing",
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

const cd2AssetsResponse = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        label: "Fire Station 60",
        category: "PUBLIC SAFETY",
        neighborhood: "Valley Village",
        council_district: 2,
        precision: "rooftop",
      },
      geometry: { type: "Point", coordinates: [-118.39, 34.16] },
    },
    {
      type: "Feature",
      properties: {
        label: "Vineland Avenue Median",
        category: "DISTRICT PROJECTS & OFFICE",
        neighborhood: "Districtwide",
        council_district: 2,
        precision: "rooftop",
      },
      geometry: { type: "Point", coordinates: [-118.37, 34.15] },
    },
  ],
};

const cd2NeighborhoodsResponse = {
  type: "FeatureCollection",
  district_source_url: "https://cd2.lacity.gov/district-2",
  features: [
    {
      type: "Feature",
      properties: {
        CSA_Label: "Los Angeles - Valley Village",
        source_url: "https://cd2.lacity.gov/district-2/valley-village",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-118.4, 34.15],
          [-118.38, 34.15],
          [-118.38, 34.17],
          [-118.4, 34.17],
          [-118.4, 34.15],
        ]],
      },
    },
  ],
};

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

  if (url.includes("cd2-civic-assets.geojson")) {
    return Promise.resolve(new Response(JSON.stringify(cd2AssetsResponse)));
  }

  if (url.includes("cd2-neighborhoods.geojson")) {
    return Promise.resolve(new Response(JSON.stringify(cd2NeighborhoodsResponse)));
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

  it("drops the address location pin (labelled with the address) when the URL carries a geocoded focus point", async () => {
    render(
      <MemoryRouter initialEntries={["/map?focusLat=34.05&focusLng=-118.24&focusLabel=City+Hall"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("img", { name: "Your searched address: City Hall" }),
    ).toBeInTheDocument();
    // The hover card carries the address text (revealed on hover via CSS).
    expect(screen.getByText("City Hall")).toBeInTheDocument();
  });

  it("tap-toggles the address pin's label card open and closed (touch fallback for hover)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/map?focusLat=34.05&focusLng=-118.24&focusLabel=City+Hall"]}>
        <App />
      </MemoryRouter>,
    );

    const pin = await screen.findByRole("img", { name: "Your searched address: City Hall" });
    // Closed by default (card is only revealed via hover/focus/the --open class).
    expect(pin).not.toHaveClass("map-address-marker--open");

    await user.click(pin);
    expect(pin).toHaveClass("map-address-marker--open");

    await user.click(pin);
    expect(pin).not.toHaveClass("map-address-marker--open");
  });

  it("shows no address pin on the plain map (no focus point)", async () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByTestId("mock-boundary-source");
    expect(screen.queryByRole("img", { name: "Your searched address" })).not.toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    });
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

    await waitFor(() => {
      expect(screen.queryByLabelText("Project details")).not.toBeInTheDocument();
    });
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

  it("reveals a category description from the accessibility icon legend", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Toggle accessibility information"));
    const legend = screen.getByLabelText("Map icon legend");

    const housingItem = within(legend).getByText("Housing").closest(".map-guidance-icon-item");
    expect(housingItem).not.toBeNull();

    const explain = within(housingItem as HTMLElement).getByRole("button", { name: "What does this mean" });
    expect(explain).toHaveAttribute("aria-expanded", "false");

    await user.click(explain);

    expect(explain).toHaveAttribute("aria-expanded", "true");
    expect(
      within(housingItem as HTMLElement).getByText(/availability, affordability, and regulation of residential spaces/),
    ).toBeInTheDocument();

    await user.click(explain);
    expect(
      within(housingItem as HTMLElement).queryByText(/availability, affordability, and regulation/),
    ).toBeNull();
  });

  it("shows the project category on the marker hover card", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.hover(await screen.findByLabelText("Council File 25-0358"));

    // The card is the only role="tooltip" here; scope to it so the category legend
    // (which also lists "Housing") can't satisfy the assertion instead.
    const hoverCard = await screen.findByRole("tooltip");
    expect(within(hoverCard).getByText("Housing")).toBeInTheDocument();
    expect(within(hoverCard).getByText("Council File 25-0358")).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "View Source" })).toHaveAttribute(
      "href",
      "https://cityclerk.lacity.org/council-file/25-0358",
    );
    expect(await screen.findByText(formatPersonNameForDisplay("TRACI PARK"))).toBeInTheDocument();
    expect(screen.getByText(formatPersonNameForDisplay("HEATHER HUTT"))).toBeInTheDocument();
    expect(screen.getByText("Primary Mover")).toBeInTheDocument();
    expect(screen.getByText("Mover")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open expanded timeline overview/i }));
    const motionNodes = await screen.findAllByText("Motion introduced.");
    expect(motionNodes.length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByLabelText("Toggle voting record"));
    expect(await screen.findByRole("dialog", { name: /Voting record/i })).toBeInTheDocument();
    expect(await screen.findByText("Yes")).toBeInTheDocument();

    randomSpy.mockRestore();
  });

  describe("neighborhood chat demo", () => {
    it("opens from the control below Neighborhoods, displays verified results, and restores the map on close", async () => {
      vi.mocked(interpretQuestion).mockResolvedValue({ action: "find", resource_type: "fire", resource_name: null, neighborhood: null, field: null });
      const user = userEvent.setup();
      render(<MemoryRouter initialEntries={["/map"]}><App /></MemoryRouter>);
      await screen.findByLabelText("Council File 25-0358");
      const controls = within(screen.getByLabelText("Map controls")).getAllByRole("button");
      const neighborhoodIndex = controls.indexOf(screen.getByLabelText("Show neighborhood boundaries and resources"));
      expect(controls[neighborhoodIndex + 1]).toHaveAccessibleName("Open CD2 neighborhood chat");
      await user.click(controls[neighborhoodIndex + 1]);
      const chat = await screen.findByLabelText("CD2 neighborhood chat");
      expect(chat).toHaveClass("project-chat-panel");
      expect(document.querySelector(".project-chat-root--docked")).not.toBeNull();
      expect(within(chat).getByLabelText("Resize chat panel")).toBeInTheDocument();
      const input = within(chat).getByLabelText("Your question");
      await waitFor(() => expect(input).not.toBeDisabled());
      await user.type(input, "Where are the fire stations?");
      await user.click(within(chat).getByRole("button", { name: "Send" }));
      const results = await screen.findByLabelText("Matching neighborhood resources");
      expect(within(results).getByText("Fire Station 60")).toBeInTheDocument();
      expect(screen.getByTestId("layer-cd2-neighborhood-chat-highlights")).toHaveAttribute("data-filter", expect.stringContaining("Fire Station 60"));
      await user.click(within(chat).getByLabelText("Close neighborhood chat"));
      expect(screen.queryByLabelText("CD2 neighborhood chat")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Matching neighborhood resources")).not.toBeInTheDocument();
      expect(await screen.findByLabelText("Council File 25-0358")).toBeInTheDocument();
    });
  });

  describe("neighborhood mode", () => {
    async function enterNeighborhoodMode() {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/map"]}>
          <App />
        </MemoryRouter>,
      );
      await screen.findByTestId("mock-boundary-source");
      await user.click(
        screen.getByLabelText("Show neighborhood boundaries and resources"),
      );
      await screen.findByTestId("layer-cd2-asset-points");
      return user;
    }

    it("greys out the other districts and drops their colour fill and labels", async () => {
      await enterNeighborhoodMode();

      // The scrim is what puts everything outside the focused district out of focus.
      expect(screen.getByTestId("layer-district-fill-scrim")).toBeInTheDocument();
      // A saturated fill on another district would pull attention straight back out.
      expect(screen.queryByTestId("layer-district-fill-selected")).not.toBeInTheDocument();
      expect(screen.queryByTestId("layer-district-highlight")).not.toBeInTheDocument();
    });

    it("restores the district fills when neighborhood mode is turned back off", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByLabelText("Show neighborhood boundaries and resources"));

      await waitFor(() =>
        expect(screen.queryByTestId("layer-district-fill-scrim")).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("layer-district-fill-selected")).toBeInTheDocument();
      expect(screen.queryByTestId("layer-cd2-asset-points")).not.toBeInTheDocument();
    });

    it("draws the neighborhood boundary casing under the outline", async () => {
      await enterNeighborhoodMode();
      expect(screen.getByTestId("layer-cd2-neighborhood-outline-casing")).toBeInTheDocument();
      expect(screen.getByTestId("layer-cd2-neighborhood-outline")).toBeInTheDocument();
    });

    // Explicit requirement: a district must not become selected while the overlay is on.
    it("ignores a district click while neighborhood mode is on", async () => {
      await enterNeighborhoodMode();
      expect(screen.queryByLabelText(/Open District 11 overview/)).not.toBeInTheDocument();

      await userEvent.setup().click(screen.getByTestId("mock-boundary-click"));

      expect(screen.queryByLabelText(/Open District 11 overview/)).not.toBeInTheDocument();
    });

    it("hides council file pins by default and brings them back from the flyout", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/map"]}>
          <App />
        </MemoryRouter>,
      );

      // Present before the overlay is switched on...
      await screen.findByLabelText("Council File 25-0358");

      await user.click(screen.getByLabelText("Show neighborhood boundaries and resources"));
      await screen.findByTestId("layer-cd2-asset-points");

      // ...gone once it is, so the neighbourhood layer reads on its own.
      expect(screen.queryByLabelText("Council File 25-0358")).not.toBeInTheDocument();

      await user.click(screen.getByLabelText("Also show council file pins"));

      expect(screen.getByLabelText("Council File 25-0358")).toBeInTheDocument();
    });

    it("closes the filter flyout from its X and reopens it from the Neighborhoods control", async () => {
      const user = await enterNeighborhoodMode();
      expect(screen.getByLabelText("Neighborhood resource categories")).toBeInTheDocument();

      await user.click(screen.getByLabelText("Close neighborhood resource filters"));

      expect(screen.queryByLabelText("Neighborhood resource categories")).not.toBeInTheDocument();
      // The overlay itself stays up -- the X closes the flyout, not the layer.
      expect(screen.getByTestId("layer-cd2-asset-points")).toBeInTheDocument();

      await user.click(screen.getByLabelText("Show neighborhood boundaries and resources"));

      expect(screen.getByLabelText("Neighborhood resource categories")).toBeInTheDocument();
      expect(screen.getByTestId("layer-cd2-asset-points")).toBeInTheDocument();
    });

    it("opens the neighborhood detail dock on a neighborhood click and closes it again", async () => {
      const user = await enterNeighborhoodMode();
      expect(screen.queryByLabelText("Valley Village resources")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("mock-neighborhood-click"));

      const panel = await screen.findByLabelText("Valley Village resources");
      expect(panel).toBeInTheDocument();
      // The card list is built from the loaded assets, not refetched.
      expect(within(panel).getByText("Fire Station 60")).toBeInTheDocument();
      expect(
        within(panel)
          .getByRole("link", { name: "cd2.lacity.gov/district-2/valley-village" })
          .getAttribute("href"),
      ).toBe("https://cd2.lacity.gov/district-2/valley-village");

      await user.click(screen.getByLabelText("Close Valley Village panel"));

      expect(screen.queryByLabelText("Valley Village resources")).not.toBeInTheDocument();
    });

    it("opens the district-wide panel from a District projects & office pin", async () => {
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-district-asset-click"));

      const panel = await screen.findByLabelText("District-wide resources");
      expect(within(panel).getByText("Council District 2")).toBeInTheDocument();
      // Straight from the sheet's source_url column, via the generated neighborhoods file.
      expect(
        within(panel).getByRole("link", { name: "cd2.lacity.gov/district-2" }),
      ).toBeInTheDocument();
      // Scoped to the panel: the pin's own click popup carries the same label.
      expect(within(panel).getByText("Vineland Avenue Median")).toBeInTheDocument();
    });

    // The whole point of the routing: the open panel is no obstacle to clicking a pin that
    // belongs somewhere else.
    it("switches panels when the clicked pin belongs to a different one", async () => {
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-district-asset-click"));
      expect(await screen.findByLabelText("District-wide resources")).toBeInTheDocument();

      await user.click(screen.getByTestId("mock-asset-click"));

      expect(await screen.findByLabelText("Valley Village resources")).toBeInTheDocument();
      expect(screen.queryByLabelText("District-wide resources")).not.toBeInTheDocument();
    });

    it("moves the map to a card's pin when the card is clicked", async () => {
      mockMap.easeTo.mockClear();
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-neighborhood-click"));
      const panel = await screen.findByLabelText("Valley Village resources");
      await user.click(within(panel).getByText("Fire Station 60"));

      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [-118.39, 34.16],
          // Never below the viewer's current zoom, and shifted clear of the left-hand dock.
          zoom: 15,
          offset: [184, 0],
        }),
      );
    });

    // Below the dock's full-width breakpoint there is no visible half to aim at.
    it("skips the panel offset on a narrow viewport", async () => {
      mockMap.easeTo.mockClear();
      mockMapContainer.clientWidth = 480;
      try {
        const user = await enterNeighborhoodMode();
        await user.click(screen.getByTestId("mock-neighborhood-click"));
        const panel = await screen.findByLabelText("Valley Village resources");
        await user.click(within(panel).getByText("Fire Station 60"));

        expect(mockMap.easeTo).toHaveBeenCalledWith(
          expect.objectContaining({ offset: [0, 0] }),
        );
      } finally {
        mockMapContainer.clientWidth = 1280;
      }
    });

    it("enlarges and glows the pin a card click selected", async () => {
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-neighborhood-click"));
      const panel = await screen.findByLabelText("Valley Village resources");
      // Mounted from the start, but matching nothing until something is selected.
      expect(screen.getByTestId("layer-cd2-asset-points-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("no-asset"),
      );

      await user.click(within(panel).getByText("Fire Station 60"));

      for (const id of ["cd2-asset-points-selected", "cd2-asset-points-selected-glow"]) {
        expect(screen.getByTestId(`layer-${id}`)).toHaveAttribute(
          "data-filter",
          expect.stringContaining("Fire Station 60"),
        );
      }
    });

    /**
     * The regression this guards: react-map-gl appends a layer to the TOP of the style on mount,
     * so a fill that only mounted when a neighbourhood was selected landed above the pins and
     * tinted them with its 22%-opacity orange. Every layer must exist before any selection.
     */
    it("mounts the selection and hover fills before anything is selected", async () => {
      await enterNeighborhoodMode();

      for (const id of ["cd2-neighborhood-selected", "cd2-neighborhood-hover"]) {
        expect(screen.getByTestId(`layer-${id}`)).toHaveAttribute(
          "data-filter",
          expect.stringContaining("no-neighborhood"),
        );
      }
    });

    it("keeps the pin layers above the neighborhood fills once one is selected", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByTestId("mock-neighborhood-click"));

      const rendered = Array.from(
        document.querySelectorAll<HTMLElement>("[data-testid^='layer-']"),
      ).map((node) => node.dataset.testid);
      // Mount order is style order, so the fill must still precede the pins in the DOM.
      expect(rendered.indexOf("layer-cd2-neighborhood-selected")).toBeLessThan(
        rendered.indexOf("layer-cd2-asset-points"),
      );
      expect(screen.getByTestId("layer-cd2-neighborhood-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("Valley Village"),
      );
    });

    /**
     * The selection layers carry no category filter of their own, so before this they kept
     * drawing the 1.5x icon, its backing and its glow after the base icon was filtered away --
     * a ghost pin that could not be clicked off, because those layers are not interactive.
     */
    it("hides the selected pin's highlight when its category is switched off", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByTestId("mock-asset-click"));

      expect(screen.getByTestId("layer-cd2-asset-points-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("Fire Station 60"),
      );

      await user.click(screen.getByRole("button", { name: "Deselect all" }));

      for (const id of [
        "cd2-asset-points-selected",
        "cd2-asset-points-selected-glow",
        "cd2-asset-points-selected-backing",
      ]) {
        expect(screen.getByTestId(`layer-${id}`)).toHaveAttribute(
          "data-filter",
          expect.stringContaining("no-asset"),
        );
      }
      // The contact popup is anchored to that pin, so it goes with it.
      expect(screen.queryByText("Located in Council District 2")).not.toBeInTheDocument();
    });

    // Hiding is not deselecting: the legend filters what is drawn, not what you picked.
    it("restores the highlight when the category is switched back on", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByTestId("mock-asset-click"));
      await user.click(screen.getByRole("button", { name: "Deselect all" }));
      await user.click(screen.getByRole("button", { name: "Select all" }));

      expect(screen.getByTestId("layer-cd2-asset-points-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("Fire Station 60"),
      );
    });

    it("clears the pin highlight when the resource panel is closed", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByTestId("mock-asset-click"));
      await screen.findByLabelText("Valley Village resources");

      await user.click(screen.getByLabelText("Close Valley Village panel"));

      expect(screen.queryByLabelText("Valley Village resources")).not.toBeInTheDocument();
      expect(screen.getByTestId("layer-cd2-asset-points-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("no-asset"),
      );
    });

    it("clears the pin highlight when a council file marker is opened instead", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByLabelText("Also show council file pins"));
      await user.click(screen.getByTestId("mock-asset-click"));
      await screen.findByLabelText("Valley Village resources");

      await user.click(screen.getByLabelText("Council File 25-0358"));

      expect(screen.getByTestId("layer-cd2-asset-points-selected")).toHaveAttribute(
        "data-filter",
        expect.stringContaining("no-asset"),
      );
    });

    it("shows a hover tooltip over a pin when nothing is selected", async () => {
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-asset-hover"));

      expect(screen.getByText("Click for contact details.")).toBeInTheDocument();
    });

    // A cursor tooltip stacking over an open contact card is two answers to one question.
    it("suppresses hover tooltips while a click popup is open", async () => {
      const user = await enterNeighborhoodMode();
      await user.click(screen.getByTestId("mock-asset-click"));

      await user.click(screen.getByTestId("mock-asset-hover"));

      expect(screen.queryByText("Click for contact details.")).not.toBeInTheDocument();
    });

    // The hover LAYER still tracks the cursor; only the tooltips are suppressed.
    it("keeps the hover highlight matching one pin, not every pin sharing its name", async () => {
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-asset-hover"));

      const filter = screen.getByTestId("layer-cd2-asset-points-hover").dataset.filter ?? "";
      expect(filter).toContain("Fire Station 60");
      // Label alone would match a same-named pin in another neighborhood.
      expect(filter).toContain("Valley Village");
      expect(filter).toContain("PUBLIC SAFETY");
    });

    it("flashes the clicked pin's card and clears the flash a second later", async () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      const user = await enterNeighborhoodMode();

      await user.click(screen.getByTestId("mock-asset-click"));

      const panel = await screen.findByLabelText("Valley Village resources");
      const card = within(panel).getByText("Fire Station 60").closest("li");
      expect(card?.className).toContain("is-flashing");
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

      await waitFor(() => expect(card?.className).not.toContain("is-flashing"), { timeout: 2000 });
    });
  });
});
