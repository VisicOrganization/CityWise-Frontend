import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EncampmentMonthFilter } from "./EncampmentMonthFilter";

afterEach(cleanup);

const OPTIONS = [
  { key: "2026-01", label: "Jan", count: 666 },
  { key: "2026-02", label: "Feb", count: 600 },
  { key: "2026-03", label: "Mar", count: 460 },
];

async function renderOpen(hiddenMonths = new Set<string>()) {
  const onHiddenMonthsChange = vi.fn();
  render(
    <EncampmentMonthFilter
      options={OPTIONS}
      hiddenMonths={hiddenMonths}
      onHiddenMonthsChange={onHiddenMonthsChange}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Filter encampment reports by month filed" }));
  return onHiddenMonthsChange;
}

describe("EncampmentMonthFilter", () => {
  it("is closed until its Filter button is pressed, like the /map filter", async () => {
    render(<EncampmentMonthFilter options={OPTIONS} hiddenMonths={new Set()} onHiddenMonthsChange={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Encampment report filters" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Filter encampment reports by month filed" }));
    expect(screen.getByRole("group", { name: "Encampment report filters" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close month filter" }));
    expect(screen.queryByRole("group", { name: "Encampment report filters" })).not.toBeInTheDocument();
  });

  it("checks every month that is not hidden, and counts only the shown reports", async () => {
    await renderOpen(new Set(["2026-02"]));
    expect(screen.getByRole("checkbox", { name: /Jan/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Feb/ })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1,126 of 1,726 reports.");
  });

  it("hides a month when it is unchecked", async () => {
    const onChange = await renderOpen();
    await userEvent.click(screen.getByRole("checkbox", { name: /Feb/ }));
    expect(onChange).toHaveBeenCalledWith(new Set(["2026-02"]));
  });

  it("selects and deselects every month from the quick actions", async () => {
    const onChange = await renderOpen(new Set(["2026-01"]));
    await userEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(onChange).toHaveBeenLastCalledWith(new Set(["2026-01", "2026-02", "2026-03"]));
    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });
});
