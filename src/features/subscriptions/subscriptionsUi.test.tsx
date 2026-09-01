import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { DistrictMultiSelect } from "./DistrictMultiSelect";
import { formatQuotaLabel, isTrialPlan } from "./PlanSummary";
import { QuotaBanner } from "./QuotaBanner";

afterEach(() => {
  cleanup();
});

describe("subscriptions UI helpers", () => {
  it("formats unlimited and remaining quota", () => {
    expect(
      formatQuotaLabel({
        scrapesUsed: 3,
        scrapesRemaining: null,
        isUnlimited: true,
        scrapeQuotaMonthly: null,
      }),
    ).toBe("Unlimited");

    expect(
      formatQuotaLabel({
        scrapesUsed: 3,
        scrapesRemaining: 22,
        isUnlimited: false,
        scrapeQuotaMonthly: 25,
      }),
    ).toBe("22 remaining (3 / 25 used)");
  });

  it("detects trial plans", () => {
    expect(isTrialPlan("trial_link_only", "manual")).toBe(true);
    expect(isTrialPlan("starter_manual_unlimited", "manual")).toBe(false);
  });

  it("enforces max_districts on multi-select", async () => {
    const user = userEvent.setup();
    let selected = [1];
    const { rerender } = render(
      <DistrictMultiSelect
        selected={selected}
        maxDistricts={1}
        onChange={(next) => {
          selected = next;
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(selected).toEqual([1]);

    rerender(
      <DistrictMultiSelect
        selected={selected}
        maxDistricts={2}
        onChange={(next) => {
          selected = next;
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(selected).toEqual([1, 2]);
  });

  it("locks non-CD1 districts on trial", async () => {
    const user = userEvent.setup();
    let selected = [1];
    render(
      <DistrictMultiSelect
        selected={selected}
        maxDistricts={1}
        trialLocked
        onChange={(next) => {
          selected = next;
        }}
      />,
    );
    const district2 = screen.getByTestId("district-chip-2");
    expect(district2).toBeDisabled();
    await user.click(district2);
    expect(selected).toEqual([1]);
    expect(screen.getByText(/locked to District 1/i)).toBeInTheDocument();
  });

  it("shows quota exhausted banner with upgrade CTA", () => {
    render(
      <MemoryRouter>
        <QuotaBanner visible />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Monthly scrape quota exhausted/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View plans \/ upgrade/i })).toHaveAttribute(
      "href",
      "/subscriptions/plans",
    );
  });
});
