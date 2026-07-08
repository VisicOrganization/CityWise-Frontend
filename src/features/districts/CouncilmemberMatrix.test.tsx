import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { AffiliationsMatrix } from "../../shared/api/contracts";
import { CouncilmemberMatrix } from "./CouncilmemberMatrix";

const matrix: AffiliationsMatrix = {
  members: [
    { member_id: 12, name: "TRACI PARK", district_id: 11, total_files: 200 },
    { member_id: 5, name: "NITHYA RAMAN", district_id: 4, total_files: 100 },
  ],
  bodies: [
    { category: "Committee", full_name: "Housing Committee" },
    { category: "Department", full_name: "Bureau of Sanitation" },
  ],
  cells: [
    { member_id: 12, full_name: "Bureau of Sanitation", file_count: 38, percent_of_total: 19 },
    { member_id: 12, full_name: "Housing Committee", file_count: 20, percent_of_total: 10 },
    { member_id: 5, full_name: "Bureau of Sanitation", file_count: 5, percent_of_total: 5 },
  ],
};

describe("CouncilmemberMatrix", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults the category filter to Department and hides other categories", () => {
    render(<CouncilmemberMatrix matrix={matrix} />);

    const filter = screen.getByLabelText("Filter bodies by category") as HTMLSelectElement;
    expect(filter.value).toBe("Department");

    // Department body header is present; the Committee body header is filtered out.
    expect(screen.getByRole("columnheader", { name: /Bureau of Sanitation/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Housing Committee/ })).toBeNull();
  });

  it("renders member-normalized percents with accessible per-cell labels", () => {
    render(<CouncilmemberMatrix matrix={matrix} />);

    // Members are rows by default; Traci Park's Sanitation cell shows 19%.
    expect(
      screen.getByRole("cell", { name: "Traci Park — Bureau of Sanitation: 19% (38 of 200 files)" }),
    ).toBeInTheDocument();
  });

  it("flips the axes when transposed", async () => {
    const user = userEvent.setup();
    render(<CouncilmemberMatrix matrix={matrix} />);

    // Default: members are row headers.
    expect(screen.getByRole("rowheader", { name: /Traci Park/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Bodies as rows/ }));

    // After transpose: the body becomes a row header and the member becomes a column header.
    expect(screen.getByRole("rowheader", { name: /Bureau of Sanitation/ })).toBeInTheDocument();
    const memberColumn = screen.getByRole("columnheader", { name: /Traci Park/ });
    expect(memberColumn).toBeInTheDocument();
    // Same underlying value is still reachable after the flip.
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("cell", { name: "Traci Park — Bureau of Sanitation: 19% (38 of 200 files)" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state until data arrives", () => {
    render(<CouncilmemberMatrix matrix={null} isLoading />);
    expect(screen.getByText(/Loading councilmember metadata/)).toBeInTheDocument();
  });
});
