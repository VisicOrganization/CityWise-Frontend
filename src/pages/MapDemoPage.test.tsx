import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";


vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="demo-map">{children}</div>,
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
  ],
};


describe("mock app routes", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the landing page as the entry point", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Visualize Your Council Member's Impact")).toBeInTheDocument();
    const input = screen.getByLabelText("Search address");
    await user.type(input, "123 Main St");
    expect(input).toHaveValue("123 Main St");
  });

  it("submits the landing search on Enter", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://nominatim.openstreetmap.org/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                place_id: 3,
                display_name: "456 Sunset Blvd, Los Angeles, California, United States",
                lat: "34.0983",
                lon: "-118.3267",
              },
            ]),
          ),
        );
      }

      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search address");
    await user.type(input, "456 Sunset Blvd{Enter}");

    expect(await screen.findByLabelText("Search query")).toHaveValue("456 Sunset Blvd");
  });

  it("renders the general map-only mock screen", async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      if (url.startsWith("https://nominatim.openstreetmap.org/search")) {
        return Promise.resolve(
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
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });

    render(
      <MemoryRouter initialEntries={["/map?q=123%20Main%20St"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("demo-map")).toBeInTheDocument();
    expect(screen.getByText("John Lee • District 12")).toBeInTheDocument();
    expect(await screen.findByLabelText("Search query")).toHaveValue("123 Main St");
    expect(await screen.findByText("123 Main St, Los Angeles, California, United States")).toBeInTheDocument();
  });

  it("submits the map search from the icon and Enter key", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      if (url.includes("q=200+N+Spring+St")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                place_id: 1,
                display_name: "200 N Spring St, Los Angeles, California, United States",
                lat: "34.0537",
                lon: "-118.2428",
              },
            ]),
          ),
        );
      }

      if (url.includes("q=City+Hall")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                place_id: 2,
                display_name: "City Hall, Los Angeles, California, United States",
                lat: "34.0536",
                lon: "-118.2427",
              },
            ]),
          ),
        );
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Search query");
    await user.type(input, "200 N Spring St");
    await user.click(screen.getByLabelText("Search map"));

    expect(await screen.findByText("200 N Spring St, Los Angeles, California, United States")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "City Hall{Enter}");

    expect(await screen.findByText("City Hall, Los Angeles, California, United States")).toBeInTheDocument();
  });

  it("opens the details panel with backend project data when a marker is clicked", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(new Response(JSON.stringify(boundariesResponse)));
      }

      if (url.includes("/districts/11/projects")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              district_id: 11,
              page: 1,
              page_size: 12,
              total: 2,
              total_pages: 1,
              items: [
                {
                  id: "25-0358",
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
                },
                {
                  id: "25-0400",
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
                },
              ],
            }),
          ),
        );
      }

      if (url.includes("/projects/25-0358")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project: {
                id: "25-0358",
                source_council_file_id: "25-0358",
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
            }),
          ),
        );
      }

      return Promise.reject(new Error(`Unhandled fetch for ${url}`));
    });

    render(
      <MemoryRouter initialEntries={["/map"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Porter Ranch Community Park"));

    expect(await screen.findByLabelText("Project details")).toBeInTheDocument();
    expect(await screen.findByText("Council File 25-0358")).toBeInTheDocument();
    expect(await screen.findByText("TRACI PARK")).toBeInTheDocument();
    expect(await screen.findByText("Motion introduced.")).toBeInTheDocument();

    randomSpy.mockRestore();
  });
});
