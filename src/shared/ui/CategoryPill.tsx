import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { categoryDescription } from "../data/categoryDescriptions";
import type { MarkerCategory } from "../map/mapTypes";

/**
 * Derived from the pin color in CATEGORY_COLOR: background is that color at 12% over white,
 * text is that color darkened until it clears WCAG AA (4.5:1) against the background.
 * The pin color itself is too light for white or black text on 8 of the 9 categories.
 */
const CATEGORY_PILL_COLOR: Record<MarkerCategory, { background: string; color: string }> = {
  "Housing": { background: "#E0F2F1", color: "#007A74" },
  "Education": { background: "#F4EAFD", color: "#8D47CF" },
  "Infrastructure": { background: "#FCF0E4", color: "#A65B18" },
  "Public Resources": { background: "#E7EFFE", color: "#2F68D2" },
  "Equity & Community Works": { background: "#FAF6E3", color: "#846E0C" },
  "Environmental": { background: "#E0F5ED", color: "#007D4E" },
  "Public Safety": { background: "#FEE9E9", color: "#C33A3A" },
  "Economic": { background: "#FFEBF9", color: "#B53E8F" },
  "Miscellaneous": { background: "#F1EEEC", color: "#82655B" },
};

const VIEWPORT_MARGIN_PX = 12;
const PILL_GAP_PX = 8;

type Box = { top: number; bottom: number; left: number; width: number; height: number };

/**
 * Places the tooltip above the pill, flipping below when it would clear the top of the viewport,
 * and anchoring to the pill's left edge clamped so neither side runs off screen.
 */
export function computeTooltipPosition(
  pill: Box,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  let top = pill.top - tooltip.height - PILL_GAP_PX;
  if (top < VIEWPORT_MARGIN_PX) {
    top = pill.bottom + PILL_GAP_PX;
  }

  const maxLeft = viewport.width - tooltip.width - VIEWPORT_MARGIN_PX;
  const left = Math.min(Math.max(pill.left, VIEWPORT_MARGIN_PX), Math.max(maxLeft, VIEWPORT_MARGIN_PX));

  return { top, left };
}

/**
 * The pill without its tooltip, for surfaces that cannot host one — the map marker hover card is
 * `pointer-events: none`, so an interactive pill there could never be hovered or focused, and a
 * focusable element inside a `role="tooltip"` is a screen-reader trap.
 */
export function CategoryPillStatic({ category }: { category: MarkerCategory }) {
  const { background, color } = CATEGORY_PILL_COLOR[category];

  return (
    <span className="project-category-pill" style={{ background, color }}>
      {category}
    </span>
  );
}

/**
 * The pill sits inside scroll containers that clip overflow (the project sidebar and the district
 * sheet), so the tooltip is portaled to the body and positioned with fixed coordinates. No z-index
 * can escape an ancestor's overflow clip, which is why this cannot be done in CSS alone.
 */
export function CategoryPill({ category }: { category: MarkerCategory }) {
  const { background, color } = CATEGORY_PILL_COLOR[category];
  const tooltipId = useId();
  const pillRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const pill = pillRef.current;
    const tooltip = tooltipRef.current;
    if (!pill || !tooltip) {
      return;
    }

    const pillRect = pill.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    setPosition(
      computeTooltipPosition(pillRect, tooltipRect, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Fixed coordinates go stale once anything scrolls, so dismiss rather than drift.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, close]);

  return (
    <span className="category-pill-wrap">
      <span
        ref={pillRef}
        className={`project-category-pill${isOpen ? " is-active" : ""}`}
        style={{ background, color }}
        tabIndex={0}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={close}
        onFocus={() => setIsOpen(true)}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
          }
        }}
      >
        {category}
      </span>

      {isOpen
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className="category-pill-tooltip"
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                // Hidden until measured, so it never flashes at the top-left corner.
                visibility: position ? "visible" : "hidden",
              }}
            >
              {categoryDescription(category)}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
