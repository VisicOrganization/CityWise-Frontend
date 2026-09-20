import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NeighborhoodAssetPopup } from "./NeighborhoodAssetPopup";

afterEach(cleanup);

describe("NeighborhoodAssetPopup", () => {
  // email is filled on 11 of the 81 source rows and meeting_information on 14, so a fixed
  // six-row layout would be mostly empty labels. Absent fields must not render their <dt>.
  it("omits fields that are absent rather than rendering empty rows", () => {
    render(
      <NeighborhoodAssetPopup
        districtId={2}
        properties={{
          label: "Valley Plaza Park",
          category: "RECREATION & PARKS",
          neighborhood: "North Hollywood",
          address: "12240 Archwood St., North Hollywood, CA 91606",
          phone: "(818) 765-5885",
          precision: "rooftop",
        }}
      />,
    );

    expect(screen.getByText("Valley Plaza Park")).toBeTruthy();
    expect(screen.getByText("(818) 765-5885")).toBeTruthy();
    expect(screen.queryByText("Email")).toBeNull();
    expect(screen.queryByText("Meetings")).toBeNull();
    expect(screen.queryByText("Website")).toBeNull();
  });

  it("renders every field when all are present", () => {
    render(
      <NeighborhoodAssetPopup
        districtId={2}
        properties={{
          label: "NoHo Northeast Neighborhood Council",
          category: "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES",
          neighborhood: "North Hollywood",
          address: "7063 Laurel Canyon, North Hollywood, CA 91605",
          phone: "(818) 627-8505",
          email: "Board@NHNENC.org",
          meeting_information: "Board Meeting: 2nd Wed. at 7:00 p.m.",
          website: "http://www.nhnenc.org/",
          precision: "rooftop",
        }}
      />,
    );

    expect(screen.getByText("Phone")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Meetings")).toBeTruthy();
    // The scheme is stripped for display so a long URL does not wrap over three lines.
    expect(screen.getByText("www.nhnenc.org")).toBeTruthy();
  });

  // 28 of the 81 rows sit in a neighbouring district and are deliberately still pinned.
  it("names the district when a pin is outside the one being viewed", () => {
    render(
      <NeighborhoodAssetPopup
        districtId={2}
        properties={{
          label: "Van Nuys Community Police Station",
          category: "PUBLIC SAFETY",
          neighborhood: "Van Nuys",
          council_district: 6,
          precision: "rooftop",
        }}
      />,
    );
    expect(screen.getByText(/Council District 6/)).toBeTruthy();
  });

  it("says nothing about the district when the pin is inside it", () => {
    render(
      <NeighborhoodAssetPopup
        districtId={2}
        properties={{
          label: "Fire Station 60",
          category: "PUBLIC SAFETY",
          neighborhood: "Valley Village",
          council_district: 2,
          precision: "rooftop",
        }}
      />,
    );
    expect(screen.queryByText(/Council District/)).toBeNull();
  });

  it("lists the neighbourhoods a merged pin serves", () => {
    render(
      <NeighborhoodAssetPopup
        districtId={2}
        properties={{
          label: "North Hollywood Police Station",
          category: "PUBLIC SAFETY",
          neighborhood: "Multiple neighborhoods",
          serves: "Studio City, Toluca Lake, Valley Glen, Valley Village",
          council_district: 2,
          precision: "rooftop",
        }}
      />,
    );
    expect(screen.getByText(/Serves Studio City, Toluca Lake/)).toBeTruthy();
  });

  it("falls back to a placeholder when the label is missing", () => {
    render(<NeighborhoodAssetPopup districtId={2} properties={{}} />);
    expect(screen.getByText("Unnamed location")).toBeTruthy();
  });
});
