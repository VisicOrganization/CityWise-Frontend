import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsaFilterSection } from "./CsaFilterSection";
import type { CsaRow } from "./csaIndex";

afterEach(cleanup);

function row(displayName: string, group: CsaRow["group"] = "losAngeles"): CsaRow {
  const prefix = group === "losAngeles" ? "Los Angeles - " : "City of ";
  return {
    CSA_Label: `${prefix}${displayName}`,
    Total_Pop: 10,
    displayName,
    group,
  };
}

const ROWS = [row("Venice"), row("Sun Valley"), row("Van Nuys")];

function renderSection(hiddenLabels: Set<string>, onHiddenChange = vi.fn()) {
  render(
    <CsaFilterSection
      rows={ROWS}
      hiddenLabels={hiddenLabels}
      onHiddenChange={onHiddenChange}
      onSelectDistrict={vi.fn()}
    />,
  );
  return onHiddenChange;
}

describe("CsaFilterSection count heading", () => {
  it("reads as all neighborhoods when nothing is hidden", () => {
    renderSection(new Set());
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("All 3 neighborhoods");
  });

  it("counts the hidden rows when some are hidden", () => {
    renderSection(new Set(["Los Angeles - Venice"]));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("2 of 3 neighborhoods");
  });

  it("reads as none when every row is hidden", () => {
    renderSection(new Set(ROWS.map((entry) => entry.CSA_Label)));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("No neighborhoods");
  });

  /**
   * The regression this guards.
   *
   * `readHiddenCsaLabels` deliberately does not cross-check stored labels against the loaded
   * index, on the stated grounds that a stale label is inert. It is inert for the map, because
   * `buildHiddenCsaFilter`'s `in` test never matches it -- but this heading used to count the
   * raw Set size, so one stale entry claimed a row was hidden while all of them were on screen.
   */
  it("ignores stored labels that are not in the current index", () => {
    renderSection(new Set(["Los Angeles - A Neighborhood That No Longer Exists"]));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("All 3 neighborhoods");
  });

  it("counts only the real rows when stale and live labels are mixed", () => {
    renderSection(new Set(["Los Angeles - Venice", "Unincorporated - Gone"]));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("2 of 3 neighborhoods");
  });

  // Every row stale would once have read "No neighborhoods" over a fully visible map.
  it("does not claim everything is hidden when every stored label is stale", () => {
    renderSection(new Set(["City of Gone", "City of Also Gone", "City of Still Gone"]));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("All 3 neighborhoods");
  });
});

describe("CsaFilterSection row toggles", () => {
  it("checks a row when it is not hidden, and hides it on click", async () => {
    const onHiddenChange = renderSection(new Set());

    const venice = screen.getByRole("checkbox", { name: /Venice/ });
    expect(venice).toBeChecked();
    await userEvent.click(venice);

    expect(onHiddenChange).toHaveBeenCalledTimes(1);
    expect([...onHiddenChange.mock.calls[0][0]]).toEqual(["Los Angeles - Venice"]);
  });

  it("unhides a hidden row without disturbing a stale stored label", async () => {
    const stale = "Los Angeles - Gone";
    const onHiddenChange = renderSection(new Set(["Los Angeles - Venice", stale]));

    await userEvent.click(screen.getByRole("checkbox", { name: /Venice/ }));

    const next = onHiddenChange.mock.calls[0][0] as Set<string>;
    expect(next.has("Los Angeles - Venice")).toBe(false);
    // Left alone rather than swept: this component filters rows, it does not own storage repair.
    expect(next.has(stale)).toBe(true);
  });
});
