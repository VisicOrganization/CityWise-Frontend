import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataSourcesSection } from "./DataSourcesSection";
import { DATA_SOURCES, type DataSourceToggleKey } from "./dataSources";

afterEach(cleanup);

const ALL_ON: Record<DataSourceToggleKey, boolean> = {
  choropleth: true,
  shelters: true,
  districtBoundary: true,
};
const ALL_OFF: Record<DataSourceToggleKey, boolean> = {
  choropleth: false,
  shelters: false,
  districtBoundary: false,
};

describe("DataSourcesSection", () => {
  it("documents every dataset the page draws from", () => {
    render(<DataSourcesSection layerState={ALL_ON} />);

    for (const entry of DATA_SOURCES) {
      expect(screen.getByText(entry.name)).toBeInTheDocument();
    }
  });

  /**
   * The section reflects the Layers toggles and owns none of them. Two checkboxes for one layer
   * is the failure mode the component's header comment exists to prevent, so nothing here may
   * be interactive beyond the native <details> disclosure.
   */
  it("offers no control of its own, only a disclosure per entry", () => {
    const { container } = render(<DataSourcesSection layerState={ALL_ON} />);

    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("details").length).toBe(DATA_SOURCES.length);
  });

  it("reports each layer as Shown when its toggle is on", () => {
    render(<DataSourcesSection layerState={ALL_ON} />);

    const layerCount = DATA_SOURCES.filter((entry) => entry.toggleKey !== null).length;
    expect(screen.getAllByText("Shown")).toHaveLength(layerCount);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("reports each layer as Hidden when its toggle is off", () => {
    render(<DataSourcesSection layerState={ALL_OFF} />);

    const layerCount = DATA_SOURCES.filter((entry) => entry.toggleKey !== null).length;
    expect(screen.getAllByText("Hidden")).toHaveLength(layerCount);
    expect(screen.queryByText("Shown")).not.toBeInTheDocument();
  });

  it("tracks each toggle independently rather than reading one flag for all", () => {
    render(<DataSourcesSection layerState={{ ...ALL_OFF, shelters: true }} />);

    expect(screen.getAllByText("Shown")).toHaveLength(1);
  });

  // A dataset with no toggle is not a layer; it must state why rather than claim to be hidden.
  it("gives a non-layer dataset its static reason instead of a Shown/Hidden state", () => {
    render(<DataSourcesSection layerState={ALL_OFF} />);

    for (const entry of DATA_SOURCES.filter((candidate) => candidate.toggleKey === null)) {
      expect(screen.getByText(entry.staticReason ?? "")).toBeInTheDocument();
    }
  });

  /**
   * Collapsing an entry hides the detail, never the provenance: the origin rides on the
   * <summary>, so it stays readable with every entry shut.
   */
  it("keeps each dataset's origin visible while its details are collapsed", () => {
    const { container } = render(<DataSourcesSection layerState={ALL_ON} />);

    expect(container.querySelectorAll("details[open]")).toHaveLength(0);
    for (const entry of DATA_SOURCES) {
      const summary = screen.getByText(entry.name).closest("summary");
      expect(summary?.textContent).toContain(entry.origin);
    }
  });
});
