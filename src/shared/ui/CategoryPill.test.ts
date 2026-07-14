import { describe, expect, it } from "vitest";

import { computeTooltipPosition } from "./CategoryPill";

const tooltip = { width: 280, height: 110 };
const viewport = { width: 1280, height: 800 };

function pillAt(left: number, top: number) {
  return { left, top, bottom: top + 26, width: 90, height: 26 };
}

describe("computeTooltipPosition", () => {
  it("sits above the pill when there is room", () => {
    const { top, left } = computeTooltipPosition(pillAt(400, 500), tooltip, viewport);

    expect(top).toBe(500 - 110 - 8);
    expect(left).toBe(400);
  });

  it("flips below the pill when it would run off the top of the viewport", () => {
    // Pill near the top of the sidebar: 40px of headroom cannot fit a 110px tooltip.
    const pill = pillAt(400, 40);
    const { top } = computeTooltipPosition(pill, tooltip, viewport);

    expect(top).toBe(pill.bottom + 8);
  });

  it("keeps the tooltip on screen when the pill is near the left edge", () => {
    const { left } = computeTooltipPosition(pillAt(2, 500), tooltip, viewport);

    expect(left).toBe(12);
  });

  it("pulls the tooltip left when the pill is near the right edge", () => {
    const { left } = computeTooltipPosition(pillAt(1240, 500), tooltip, viewport);

    expect(left).toBe(1280 - 280 - 12);
    expect(left + tooltip.width).toBeLessThanOrEqual(viewport.width);
  });

  it("stays within a narrow viewport rather than going negative", () => {
    const narrow = { width: 320, height: 640 };
    const { left } = computeTooltipPosition(pillAt(200, 400), { width: 300, height: 140 }, narrow);

    expect(left).toBeGreaterThanOrEqual(12);
  });
});
