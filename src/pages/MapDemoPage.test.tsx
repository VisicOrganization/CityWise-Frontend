import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../App";


vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="demo-map">{children}</div>,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));


describe("mock app routes", () => {
  it("renders the landing page as the entry point", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Visualize Your Council Member's Impact")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/map");
  });

  it("renders the general map-only mock screen", () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("demo-map")).toBeInTheDocument();
    expect(screen.getByText("John Lee • District 12")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3096")).toBeInTheDocument();
  });
});
