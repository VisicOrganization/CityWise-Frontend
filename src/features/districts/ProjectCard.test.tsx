import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProjectCard } from "./ProjectCard";

const baseProps = {
  title: "Council File 25-0358",
  statusLabel: "Passed",
  statusVariant: "completed" as const,
  subtitle: "Housing",
  description: "Wildfire recovery motion.",
  startDate: "April 4, 2025",
  completedStatus: "April 11, 2025",
};

describe("ProjectCard (district overview)", () => {
  it("renders the category pill under the status badge", () => {
    const { container } = render(
      <ProjectCard {...baseProps} layoutVariant="districtOverview" category="Public Safety" />,
    );

    const pill = within(container).getByText("Public Safety");
    expect(pill).toHaveClass("project-category-pill");

    const actions = pill.closest(".district-overview-project-card__top-actions");
    expect(actions).not.toBeNull();
    expect(actions?.querySelector(".status-badge")?.textContent).toBe("Passed");
  });

  it("omits the pill when no category is given", () => {
    const { container } = render(<ProjectCard {...baseProps} layoutVariant="districtOverview" />);

    expect(container.querySelector(".project-category-pill")).toBeNull();
  });

  it("shows a tooltip with that category's description on hover, and hides it again", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProjectCard {...baseProps} layoutVariant="districtOverview" category="Public Safety" />,
    );

    const pill = within(container).getByText("Public Safety");
    expect(document.querySelector(".category-pill-tooltip")).toBeNull();

    await user.hover(pill);

    // Portaled to <body>, so it is outside the card's container.
    const tooltip = document.querySelector(".category-pill-tooltip");
    expect(tooltip?.textContent).toContain("protecting residents from crime, emergencies, and health crises");
    // The pill points at the tooltip, so screen readers announce the description too.
    expect(pill.getAttribute("aria-describedby")).toBe(tooltip?.id);

    await user.unhover(pill);
    expect(document.querySelector(".category-pill-tooltip")).toBeNull();
  });
});
