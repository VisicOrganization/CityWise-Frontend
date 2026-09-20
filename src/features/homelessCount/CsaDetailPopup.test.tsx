import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CsaDetailPopup } from "./CsaDetailPopup";

afterEach(cleanup);

describe("CsaDetailPopup density formatting", () => {
  it("does not round a real, non-zero sheltered density down to 0 (City of Compton case)", () => {
    render(
      <CsaDetailPopup
        properties={{
          CSA_Label: "City of Compton",
          Total_Pop: 2,
          Total_Unsheltered_Pop: 0,
          Total_Sheltered_Pop: 2,
          Density_Total: 0.211,
          Density_Unsheltered: 0,
          Density_Sheltered: 0.211,
          Square_Miles: 9.5,
        }}
      />,
    );

    // Density_Unsheltered is legitimately 0 here (no unsheltered people), so only the
    // sheltered-density row is asserted against — it must not read "0 per sq. mile".
    const shelteredDensityRow = screen.getByText("Density (sheltered)").closest("div");
    expect(shelteredDensityRow?.textContent).not.toMatch(/^Density \(sheltered\)0 per sq\. mile$/);
    expect(shelteredDensityRow?.textContent).toContain("0.21 per sq. mile");
  });

  it("still renders an exact zero density as \"0\", not \"0.00\"", () => {
    render(
      <CsaDetailPopup
        properties={{
          CSA_Label: "Some Area",
          Total_Pop: 0,
          Total_Unsheltered_Pop: 0,
          Total_Sheltered_Pop: 0,
          Density_Total: 0,
          Density_Unsheltered: 0,
          Density_Sheltered: 0,
          Square_Miles: 5,
        }}
      />,
    );

    expect(screen.getAllByText(/^0 per sq\. mile/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/0\.00 per sq\. mile/)).not.toBeInTheDocument();
  });

  it("keeps a large density rounded to a whole number with thousands separators", () => {
    render(
      <CsaDetailPopup
        properties={{
          CSA_Label: "Dense Area",
          Total_Pop: 3146,
          Total_Unsheltered_Pop: 0,
          Total_Sheltered_Pop: 3146,
          Density_Total: 3146,
          Density_Unsheltered: 0,
          Density_Sheltered: 3146,
          Square_Miles: 1,
        }}
      />,
    );

    expect(screen.getAllByText(/3,146 per sq\. mile/).length).toBeGreaterThan(0);
  });
});
