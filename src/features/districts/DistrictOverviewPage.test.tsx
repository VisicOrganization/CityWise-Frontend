import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DistrictOverviewPage } from "./DistrictOverviewPage";


vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="district-map">{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));


describe("DistrictOverviewPage", () => {
  it("renders fetched district projects", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/la-city-council-districts.geojson")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {
                    District: 11,
                    District_Name: "11 - Traci Park",
                    NAME: "Traci Park",
                    NLA_URL: "",
                    OBJECTID: 11,
                    TOOLTIP: "",
                  },
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [-118.5, 33.9],
                        [-118.4, 33.9],
                        [-118.4, 34.0],
                        [-118.5, 34.0],
                        [-118.5, 33.9],
                      ],
                    ],
                  },
                },
              ],
            }),
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            district_id: 11,
            page: 1,
            page_size: 3,
            total: 1,
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
            ],
          }),
        ),
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/districts/11"]}>
        <Routes>
          <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading district projects…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Council File 25-0358")).toBeInTheDocument();
    });

    expect(screen.getByText("Wildfire recovery motion.")).toBeInTheDocument();
    expect(screen.getByText("Jordan Alvarez • District 11")).toBeInTheDocument();
    expect(screen.getByText("councilmember.jordan.alvarez@lacity.org")).toBeInTheDocument();
    expect(screen.getByText("Impact Summary")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByTestId("district-map-shell")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });
});
