import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DistrictOverviewPage } from "./DistrictOverviewPage";


vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="district-map">{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));


describe("DistrictOverviewPage", () => {
  it("redirects district routes into the map districtFocus query flow", async () => {
    function LocationDisplay() {
      const location = useLocation();
      return <div>{`${location.pathname}${location.search}`}</div>;
    }

    render(
      <MemoryRouter initialEntries={["/districts/11"]}>
        <Routes>
          <Route path="/districts/:districtId" element={<DistrictOverviewPage />} />
          <Route path="/map" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("/map?districtFocus=11")).toBeInTheDocument();
  });
});
