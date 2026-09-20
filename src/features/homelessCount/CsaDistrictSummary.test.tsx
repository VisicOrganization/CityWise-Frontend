import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsaDistrictSummary } from "./CsaDistrictSummary";
import type { CouncilDistrict } from "./councilDistricts";
import type { CsaRow } from "./csaIndex";

afterEach(cleanup);

const DISTRICT: CouncilDistrict = {
  id: "cd2",
  label: "District 2",
  csaLabels: ["Los Angeles - Sun Valley", "Los Angeles - Van Nuys"],
  bounds: [
    [-118.5, 34.11],
    [-118.26, 34.25],
  ],
};

const ROWS: CsaRow[] = [
  {
    CSA_Label: "Los Angeles - Sun Valley",
    Total_Pop: 1291,
    displayName: "Sun Valley",
    group: "losAngeles",
  },
  {
    CSA_Label: "Los Angeles - Van Nuys",
    Total_Pop: 549,
    displayName: "Van Nuys",
    group: "losAngeles",
  },
];

function renderSummary(
  liveAttributesByLabel: Record<string, Record<string, unknown>> = {},
  onSelectLabel = vi.fn(),
  rows: CsaRow[] = ROWS,
) {
  render(
    <CsaDistrictSummary
      district={DISTRICT}
      rows={rows}
      liveAttributesByLabel={liveAttributesByLabel}
      onSelectLabel={onSelectLabel}
    />,
  );
  return onSelectLabel;
}

describe("CsaDistrictSummary", () => {
  it("lists each of the district's neighborhoods with its own total", () => {
    renderSummary();

    expect(screen.getByText("Sun Valley")).toBeInTheDocument();
    expect(screen.getByText("1,291")).toBeInTheDocument();
    expect(screen.getByText("Van Nuys")).toBeInTheDocument();
    expect(screen.getByText("549")).toBeInTheDocument();
  });

  /**
   * The load-bearing test for this file. LAHSA's service metadata states it does not recommend
   * aggregating tract-level data to other geographies, and the component's header comment says
   * no summed total may ever be rendered here. 1291 + 549 = 1840 must not appear in any form.
   */
  it("never renders a total summed across the district's rows", () => {
    renderSummary();

    const forbidden = ROWS.reduce((total, row) => total + row.Total_Pop, 0);
    expect(forbidden).toBe(1840);
    expect(screen.queryByText("1,840")).not.toBeInTheDocument();
    expect(screen.queryByText("1840")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("1,840");
    expect(document.body.textContent?.toLowerCase()).not.toContain("total for");
  });

  it("selects a neighborhood by its full CSA label, not its display name", async () => {
    const onSelectLabel = renderSummary();

    await userEvent.click(screen.getByRole("button", { name: /Sun Valley/ }));

    expect(onSelectLabel).toHaveBeenCalledWith("Los Angeles - Sun Valley");
  });

  it("shows the unsheltered/sheltered split only for a loaded tile", () => {
    renderSummary({
      "Los Angeles - Sun Valley": {
        Total_Unsheltered_Pop: 1100,
        Total_Sheltered_Pop: 191,
      },
    });

    expect(screen.getByText("1,100 unsheltered / 191 sheltered")).toBeInTheDocument();
    expect(screen.queryByText(/unsheltered \/ 0 sheltered/)).not.toBeInTheDocument();
  });

  /**
   * A missing tile means "not loaded yet", not "counted zero". Rendering a dash or a 0/0 split
   * would state something the data does not say.
   */
  it("omits the split entirely when the tile has not loaded", () => {
    renderSummary();
    expect(screen.queryByText(/unsheltered/)).not.toBeInTheDocument();
  });

  it("omits the split when only one half of it arrived", () => {
    renderSummary({ "Los Angeles - Sun Valley": { Total_Unsheltered_Pop: 1100 } });
    expect(screen.queryByText(/unsheltered/)).not.toBeInTheDocument();
  });

  it("ignores non-numeric tile values rather than printing them", () => {
    renderSummary({
      "Los Angeles - Sun Valley": {
        Total_Unsheltered_Pop: "1100",
        Total_Sheltered_Pop: null,
      },
    });
    expect(screen.queryByText(/unsheltered/)).not.toBeInTheDocument();
  });

  // A label in the district preset with no row in the index still gets a row, with a dash, so
  // the neighborhood does not silently vanish from the district's list.
  it("falls back to a dash and a derived name for a label missing from the index", () => {
    renderSummary({}, vi.fn(), [ROWS[0]]);

    const vanNuys = screen.getByRole("button", { name: /Van Nuys/ });
    expect(within(vanNuys).getByText("—")).toBeInTheDocument();
  });
});
