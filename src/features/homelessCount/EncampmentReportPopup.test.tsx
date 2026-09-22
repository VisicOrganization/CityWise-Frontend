import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { EncampmentReportPopup, formatReportTimestamp } from "./EncampmentReportPopup";

afterEach(cleanup);

// Shaped exactly like a feature in public/data/cd2-encampment-reports.geojson.
function report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    caseNumber: "04684510",
    address: "12345 W Vanowen St",
    zip: "91605",
    nc: "NoHo West NC",
    created: "2026-09-21T21:39:16.000",
    origin: "Self Service",
    department: "LA Sanitation – Livability Services",
    anonymous: false,
    apc: "South Valley APC",
    lapdArea: "North Hollywood",
    ...overrides,
  };
}

describe("formatReportTimestamp", () => {
  it("formats LA wall-clock time without shifting it into the viewer's timezone", () => {
    expect(formatReportTimestamp("2026-09-21T21:39:16.000")).toBe("Sep 21, 2026, 9:39 PM");
    // Near midnight is where a timezone shift would also change the date.
    expect(formatReportTimestamp("2026-01-01T00:05:00.000")).toBe("Jan 1, 2026, 12:05 AM");
    expect(formatReportTimestamp("2026-07-04T12:00:00.000")).toBe("Jul 4, 2026, 12:00 PM");
  });

  it("returns an empty string for anything that isn't a timestamp", () => {
    expect(formatReportTimestamp(undefined)).toBe("");
    expect(formatReportTimestamp("not a date")).toBe("");
  });
});

describe("EncampmentReportPopup", () => {
  it("renders the location and every field of a single report", () => {
    render(<EncampmentReportPopup reports={[report()]} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("12345 W Vanowen St");
    expect(screen.getByText("1 report at this location")).toBeInTheDocument();
    expect(screen.getByText("NoHo West NC")).toBeInTheDocument();
    expect(screen.getByText("91605")).toBeInTheDocument();
    expect(screen.getByText("South Valley APC")).toBeInTheDocument();
    expect(screen.getByText("North Hollywood")).toBeInTheDocument();
    expect(screen.getByText("Sep 21, 2026, 9:39 PM")).toBeInTheDocument();
    expect(screen.getByText("Self Service")).toBeInTheDocument();
    expect(screen.getByText("LA Sanitation – Livability Services")).toBeInTheDocument();
    expect(screen.getByText("04684510")).toBeInTheDocument();
  });

  it("shows Closed only when the record has a distinct close date", () => {
    render(<EncampmentReportPopup reports={[report()]} />);
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
    cleanup();

    render(<EncampmentReportPopup reports={[report({ closed: "2026-09-22T08:00:00.000" })]} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Sep 22, 2026, 8:00 AM")).toBeInTheDocument();
  });

  it("says a report is outside any council rather than leaving the row blank", () => {
    render(<EncampmentReportPopup reports={[report({ nc: null })]} />);
    expect(screen.getByText("Outside any neighborhood council")).toBeInTheDocument();
  });

  it("titles facility reports by the facility, with the street address underneath", () => {
    render(
      <EncampmentReportPopup
        reports={[report({ place: "South Weddington Park", address: "10600 W Valleyheart Dr" })]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("South Weddington Park");
    expect(screen.getByText("10600 W Valleyheart Dr")).toBeInTheDocument();
  });

  it("marks anonymous reports", () => {
    render(<EncampmentReportPopup reports={[report({ anonymous: true })]} />);
    expect(screen.getByText("Self Service, anonymous")).toBeInTheDocument();
  });

  it("lists the first five of a stack and reveals the rest on request", async () => {
    const stack = Array.from({ length: 7 }, (_, index) => report({ caseNumber: `case-${index}` }));
    render(<EncampmentReportPopup reports={stack} />);

    expect(screen.getByText("7 reports at this location")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    await userEvent.click(screen.getByRole("button", { name: "Show all 7 reports" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });
});
