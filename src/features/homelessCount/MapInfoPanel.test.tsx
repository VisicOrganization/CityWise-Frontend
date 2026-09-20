import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { MapInfoPanel } from "./MapInfoPanel";

afterEach(cleanup);

function trigger() {
  return screen.getByRole("button", { name: "Info" });
}

describe("MapInfoPanel", () => {
  it("starts closed, with the trigger reporting it", () => {
    render(<MapInfoPanel />);

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("opens on the trigger and closes on a second press", async () => {
    render(<MapInfoPanel />);

    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("points the trigger at the panel it controls", async () => {
    render(<MapInfoPanel />);
    await userEvent.click(trigger());

    const controls = trigger().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls ?? "")).toBeInTheDocument();
  });

  // Landing on the close button means a keyboard user does not have to tab past the whole map.
  it("moves focus into the panel on open", async () => {
    render(<MapInfoPanel />);
    await userEvent.click(trigger());

    const close = screen.getByRole("button", { name: /close/i });
    expect(close).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<MapInfoPanel />);
    await userEvent.click(trigger());

    await userEvent.keyboard("{Escape}");

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
  });

  it("returns focus to the trigger when closed by its close button", async () => {
    render(<MapInfoPanel />);
    await userEvent.click(trigger());

    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
  });

  /**
   * The Escape listener is on `document`, so it has to come off on unmount and whenever the
   * panel closes — otherwise every open/close cycle leaves another live listener behind.
   */
  it("removes its document Escape listener when closed and when unmounted", async () => {
    const { unmount } = render(<MapInfoPanel />);
    const added: unknown[] = [];
    const removed: unknown[] = [];
    const originalAdd = document.addEventListener;
    const originalRemove = document.removeEventListener;
    document.addEventListener = (...args: Parameters<typeof originalAdd>) => {
      if (args[0] === "keydown") added.push(args[1]);
      return originalAdd.apply(document, args);
    };
    document.removeEventListener = (...args: Parameters<typeof originalRemove>) => {
      if (args[0] === "keydown") removed.push(args[1]);
      return originalRemove.apply(document, args);
    };

    try {
      await userEvent.click(trigger());
      await userEvent.click(trigger());
      unmount();
      expect(added.length).toBeGreaterThan(0);
      expect(removed).toHaveLength(added.length);
    } finally {
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
    }
  });

  // Audience is a council staffer: the reference detail belongs in the Data sources section.
  it("keeps engineering detail out of the orientation copy", async () => {
    render(<MapInfoPanel />);
    await userEvent.click(trigger());

    const text = (document.body.textContent ?? "").toLowerCase();
    for (const term of ["http", "tile url", "source-layer", "zoom level"]) {
      expect(text).not.toContain(term);
    }
  });
});
