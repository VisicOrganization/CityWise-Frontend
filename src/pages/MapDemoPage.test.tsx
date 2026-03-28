import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../App";


vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="demo-map">{children}</div>,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);


describe("mock app routes", () => {
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

  it("renders the general map-only mock screen", async () => {
    fetchMock.mockResolvedValueOnce(
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
});
