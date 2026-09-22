import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COUNCIL_DISTRICTS_GEOJSON_PATH,
  resetCouncilDistrictBoundaryCacheForTests,
} from "./councilDistrictBoundary";
import { buildHiddenForDistrict, COUNCIL_DISTRICTS } from "./councilDistricts";
import { resetCsaIndexCacheForTests, type CsaRow } from "./csaIndex";
import { DATA_SOURCES } from "./dataSources";
import { ENCAMPMENT_GEOJSON_PATH, resetEncampmentReportsCacheForTests } from "./encampmentLayers";
import { HomelessCountPage } from "./HomelessCountPage";


const VENICE = "Los Angeles - Venice";
// A second, distinct label for the hover tests — hovering must be tellable apart from clicking,
// and "hovering the selected feature" needs a feature that IS the click card's own label (VENICE).
const HOLLYWOOD = "Los Angeles - Hollywood";

// Every filter `buildHiddenCsaFilter` returns now requires this, fail-safe against tile features
// with no usable `CSA_Label` (see `csaLayers.ts`) — there is no longer an "undefined/no filter"
// case, even when nothing is hidden.
const HAS_CSA_LABEL = ["==", ["typeof", ["get", "CSA_Label"]], "string"];

function hiddenCsaFilterJson(hiddenLabels: string[]): string {
  return JSON.stringify([
    "all",
    HAS_CSA_LABEL,
    ["!", ["in", ["get", "CSA_Label"], ["literal", hiddenLabels]]],
  ]);
}

vi.mock("react-map-gl/maplibre", () => ({
  default: React.forwardRef(function MockMap(
    {
      children,
      onClick,
      onMouseMove,
      onMouseLeave,
    }: {
      children?: ReactNode;
      onClick?: (event: unknown) => void;
      onMouseMove?: (event: unknown) => void;
      onMouseLeave?: (event: unknown) => void;
    },
    ref: React.ForwardedRef<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({}));
    return (
      <div data-testid="homeless-count-map">
        <button
          type="button"
          data-testid="mock-csa-click"
          onClick={() =>
            onClick?.({
              lngLat: { lng: -118.47, lat: 33.99 },
              features: [
                {
                  properties: {
                    CSA_Label: VENICE,
                    Total_Pop: 2053,
                    Total_Unsheltered_Pop: 1901,
                    Total_Sheltered_Pop: 152,
                    Density_Total: 638.4,
                    Density_Unsheltered: 591.1,
                    Density_Sheltered: 47.3,
                    Square_Miles: 3.2,
                    Data_Source: "LAHSA 2020 Greater Los Angeles Homeless Count",
                  },
                },
              ],
            })
          }
        >
          mock csa click
        </button>
        <button
          type="button"
          data-testid="mock-csa-hover-hollywood"
          onClick={() =>
            onMouseMove?.({
              lngLat: { lng: -118.34, lat: 34.1 },
              features: [{ properties: { CSA_Label: HOLLYWOOD } }],
            })
          }
        >
          mock csa hover hollywood
        </button>
        <button
          type="button"
          data-testid="mock-csa-hover-venice"
          onClick={() =>
            onMouseMove?.({
              lngLat: { lng: -118.47, lat: 33.99 },
              features: [{ properties: { CSA_Label: VENICE } }],
            })
          }
        >
          mock csa hover venice
        </button>
        <button
          type="button"
          data-testid="mock-encampment-click"
          onClick={() =>
            onClick?.({
              lngLat: { lng: -118.3706, lat: 34.1444 },
              features: [
                {
                  layer: { id: "encampment-points" },
                  geometry: { type: "Point", coordinates: [-118.370633, 34.144452] },
                  properties: { caseNumber: "older-case", address: "4167 Fair Ave", created: "2026-03-01T09:00:00.000" },
                },
                {
                  layer: { id: "encampment-points" },
                  geometry: { type: "Point", coordinates: [-118.370633, 34.144452] },
                  properties: { caseNumber: "newer-case", address: "4167 Fair Ave", created: "2026-08-01T09:00:00.000" },
                },
                { layer: { id: "csa-fill" }, properties: { CSA_Label: HOLLYWOOD } },
              ],
            })
          }
        >
          mock encampment click
        </button>
        <button
          type="button"
          data-testid="mock-encampment-cluster-click"
          onClick={() =>
            onClick?.({
              lngLat: { lng: -118.37, lat: 34.14 },
              features: [{ layer: { id: "encampment-clusters" }, properties: { cluster_id: 7, point_count: 12 } }],
            })
          }
        >
          mock encampment cluster click
        </button>
        {/* Two different stacks, each long enough (6) to collapse behind "Show all". */}
        {[-118.36, -118.35].map((lng) => (
          <button
            key={lng}
            type="button"
            data-testid={`mock-encampment-stack-click-${lng}`}
            onClick={() =>
              onClick?.({
                lngLat: { lng, lat: 34.14 },
                features: Array.from({ length: 6 }, (_, index) => ({
                  layer: { id: "encampment-points" },
                  geometry: { type: "Point", coordinates: [lng, 34.14] },
                  properties: { caseNumber: `${lng}-${index}`, created: `2026-0${index + 1}-01T09:00:00.000` },
                })),
              })
            }
          >
            mock encampment stack click {lng}
          </button>
        ))}
        <button type="button" data-testid="mock-csa-mouseleave" onClick={() => onMouseLeave?.({})}>
          mock csa mouseleave
        </button>
        {children}
      </div>
    );
  }),
  // Introspectable so the tests can read the MapLibre filter the page actually hands MapLibre,
  // and (post-migration) whether a `source-layer` prop leaked back in — a geojson source has
  // none, and passing one is silently wrong rather than a visible error.
  Layer: (props: { id?: string; filter?: unknown; "source-layer"?: string; beforeId?: string }) => (
    <div
      data-testid={`layer-${props.id}`}
      data-before-id={props.beforeId}
      data-filter={props.filter ? JSON.stringify(props.filter) : undefined}
      data-has-source-layer={"source-layer" in props ? "true" : "false"}
    />
  ),
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="mock-popup">{children}</div>,
  // Introspectable on `id`/`type` too, so a test can confirm the CSA source is a geojson source
  // (not the vector tile source it used to be) without needing to see real map tiles.
  Source: ({
    children,
    id,
    type,
    data,
  }: {
    children?: ReactNode;
    id?: string;
    type?: string;
    data?: { features?: unknown[] } | string;
  }) => (
    <div
      data-testid={id ? `source-${id}` : undefined}
      data-source-type={type}
      data-feature-count={typeof data === "object" ? data.features?.length : undefined}
    >
      {children}
    </div>
  ),
}));

// The filter section is a sibling component with its own tests; stubbing it keeps these
// assertions on the page's filter wiring rather than on the section's internal DOM.
vi.mock("./CsaFilterSection", () => ({
  CsaFilterSection: ({
    rows,
    hiddenLabels,
    onHiddenChange,
  }: {
    rows: CsaRow[];
    hiddenLabels: Set<string>;
    onHiddenChange: (next: Set<string>) => void;
  }) => (
    <div>
      <span data-testid="stub-row-count">{rows.length}</span>
      <span data-testid="stub-hidden-count">{hiddenLabels.size}</span>
      <button type="button" data-testid="stub-hide-venice" onClick={() => onHiddenChange(new Set([VENICE]))}>
        hide venice
      </button>
      <button type="button" data-testid="stub-show-all" onClick={() => onHiddenChange(new Set())}>
        show all
      </button>
      {/* Stands in for the real "District 2" button, which lives in CsaFilterSection itself
          (stubbed out above); exercises the real `buildHiddenForDistrict` against whatever rows
          the page loaded, same as the real dropdown would. */}
      <button
        type="button"
        data-testid="stub-select-cd2"
        onClick={() => onHiddenChange(buildHiddenForDistrict(rows, COUNCIL_DISTRICTS[0]))}
      >
        District 2
      </button>
    </div>
  ),
}));

// Mirrors hiddenCsaStorage.ts's own (unexported) key — kept in sync manually since there is
// nothing to import it from.
const HIDDEN_CSA_STORAGE_KEY = "citywise:homelessCountHidden";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const indexPayload = [
  { CSA_Label: VENICE, Total_Pop: 2053 },
  { CSA_Label: "City of Long Beach", Total_Pop: 1873 },
];

// The real 304-row shipped file, for the district-preset tests below: the 2-row `indexPayload`
// above can't tell a "6 of 7" typo from a correct preset, only the real index can.
const SHIPPED_INDEX_PATH = join(__dirname, "../../../public/data/lahsa-2020-csa-index.json");
const shippedIndexPayload = JSON.parse(readFileSync(SHIPPED_INDEX_PATH, "utf-8"));

/** Stand-in for the shipped 15-district file; two districts, so "only CD2 is drawn" is testable. */
const districtBoundariesPayload = {
  type: "FeatureCollection",
  features: [1, 2].map((id) => ({
    type: "Feature",
    properties: {
      District: id,
      District_Name: `District ${id}`,
      NAME: id === 2 ? "Adrin Nazarian" : "Eunisses Hernandez",
      NLA_URL: "",
      OBJECTID: id,
      TOOLTIP: `District ${id}`,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-118.5 - id, 34.1],
          [-118.3 - id, 34.1],
          [-118.3 - id, 34.25],
          [-118.5 - id, 34.25],
          [-118.5 - id, 34.1],
        ],
      ],
    },
  })),
};

/**
 * The page now fetches two different files (the CSA index and the council-district GeoJSON), so
 * the mock has to route by URL — a single blanket response would hand the boundary loader an
 * array of CSA rows. The district path comes from `COUNCIL_DISTRICTS_GEOJSON_PATH`, which
 * `councilDistrictBoundary.test.ts` in turn pins to the shared loader's real request.
 */
/** Two reports in January, one in February — enough to see the month filter change the source. */
const encampmentPayload = {
  type: "FeatureCollection",
  features: ["2026-01-05T10:00:00.000", "2026-01-20T10:00:00.000", "2026-02-03T10:00:00.000"].map(
    (created, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-118.37 + index * 0.01, 34.14] },
      properties: { caseNumber: `case-${index}`, created },
    }),
  ),
};

function mockFetchByPath(indexData: unknown) {
  fetchMock.mockImplementation((input: unknown) => {
    const url = String(input);
    const body = url.includes(COUNCIL_DISTRICTS_GEOJSON_PATH)
      ? districtBoundariesPayload
      : url === ENCAMPMENT_GEOJSON_PATH
        ? encampmentPayload
        : indexData;
    return Promise.resolve(new Response(JSON.stringify(body)));
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/homeless-count"]}>
      <HomelessCountPage />
    </MemoryRouter>,
  );
}


describe("HomelessCountPage", () => {
  beforeEach(() => {
    resetCsaIndexCacheForTests();
    // The boundary loader memoizes across mounts on purpose (1.5 MB file); without this reset a
    // test would inherit the previous test's resolved feature.
    resetCouncilDistrictBoundaryCacheForTests();
    resetEncampmentReportsCacheForTests();
    fetchMock.mockReset();
    // The index path is resolved at module scope, so an unstubbed fetch renders the empty state
    // and every assertion below fails for the wrong reason.
    mockFetchByPath(indexPayload);
    // A stale hidden set from a previous test would make the "no filter by default" assertion
    // below fail for the wrong reason now that the page persists to localStorage.
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("labels the vintage and the publisher in the header", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "2020 Greater Los Angeles Homeless Count" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Point-in-Time count by Countywide Statistical Area/),
    ).toHaveTextContent("Los Angeles Homeless Services Authority (LAHSA)");
    expect(await screen.findByTestId("stub-row-count")).toHaveTextContent("2");
  });

  it("defaults to District 2 on a fresh load with nothing stored", async () => {
    // The 2-row `indexPayload` can't distinguish "District 2" from "everything hidden" — only
    // the real 304-row index proves exactly the 7 District 2 CSAs stayed visible.
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
    renderPage();

    // The default is applied in an effect that runs *after* the rows-loaded render, one tick
    // later than the dropdown stub itself appears — `findByTestId` alone would resolve too early.
    await waitFor(() => expect(screen.getByTestId("stub-hidden-count")).toHaveTextContent("297"));
    const hiddenInFilter: string[] = JSON.parse(
      screen.getByTestId("layer-csa-fill").getAttribute("data-filter") ?? "null",
    )[2][1][2][1];
    expect(hiddenInFilter).toHaveLength(297);
    for (const label of COUNCIL_DISTRICTS[0].csaLabels) {
      expect(hiddenInFilter).not.toContain(label);
    }
  });

  it("shows every neighborhood when the stored selection is an explicit empty array", async () => {
    // An empty array is a real "Select all" choice, not "nothing was ever stored" — it must NOT
    // be clobbered back to the District 2 default. This is the regression guard for that bug.
    localStorage.setItem(HIDDEN_CSA_STORAGE_KEY, JSON.stringify([]));
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
    renderPage();

    expect(await screen.findByTestId("stub-hidden-count")).toHaveTextContent("0");
    // No longer "no filter at all" — every feature must still carry a real `CSA_Label` to render,
    // even with nothing explicitly hidden (see `buildHiddenCsaFilter` in `csaLayers.ts`).
    const expected = JSON.stringify(HAS_CSA_LABEL);
    expect(screen.getByTestId("layer-csa-fill")).toHaveAttribute("data-filter", expected);
    expect(screen.getByTestId("layer-csa-outline")).toHaveAttribute("data-filter", expected);
  });

  it("restores a non-empty stored selection exactly, without applying the District 2 default", async () => {
    localStorage.setItem(HIDDEN_CSA_STORAGE_KEY, JSON.stringify([VENICE]));
    renderPage();

    // If the default had been applied instead, this would be 2 (both indexPayload rows, since
    // neither is a District 2 CSA), not the 1 label that was actually stored.
    expect(await screen.findByTestId("stub-hidden-count")).toHaveTextContent("1");
    expect(screen.getByTestId("layer-csa-fill")).toHaveAttribute("data-filter", hiddenCsaFilterJson([VENICE]));
  });

  it("excludes a hidden neighborhood, and restores it when it is shown again", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("stub-hide-venice"));
    const expected = hiddenCsaFilterJson([VENICE]);
    expect(screen.getByTestId("layer-csa-fill")).toHaveAttribute("data-filter", expected);
    expect(screen.getByTestId("layer-csa-outline")).toHaveAttribute("data-filter", expected);

    await user.click(screen.getByTestId("stub-show-all"));
    const allShown = JSON.stringify(HAS_CSA_LABEL);
    expect(screen.getByTestId("layer-csa-fill")).toHaveAttribute("data-filter", allShown);
    expect(screen.getByTestId("layer-csa-outline")).toHaveAttribute("data-filter", allShown);
  });

  it("mounts the CSA layer on a geojson source, not a vector tile source, with no source-layer prop", async () => {
    // Regression guard for the migration off Scout's `query` tiles: a leftover `type="vector"` or
    // `source-layer` prop is silently wrong for a geojson source, not a visible error.
    renderPage();

    expect(await screen.findByTestId("source-csa")).toHaveAttribute("data-source-type", "geojson");
    for (const layerId of ["layer-csa-fill", "layer-csa-outline"]) {
      expect(screen.getByTestId(layerId)).toHaveAttribute("data-has-source-layer", "false");
    }
  });

  it("shows the clicked neighborhood's numbers straight from the tile attributes", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("mock-csa-click"));

    const popup = await screen.findByTestId("mock-popup");
    expect(popup).toHaveTextContent(VENICE);
    expect(popup).toHaveTextContent("2,053");
    expect(popup).toHaveTextContent("1,901");
    expect(popup).toHaveTextContent("152");
    expect(popup).toHaveTextContent("638 per sq. mile");
    // The two density fields added alongside Density_Total: unsheltered and sheltered per sq mi.
    expect(popup).toHaveTextContent("591 per sq. mile");
    expect(popup).toHaveTextContent("47 per sq. mile");
    expect(popup).toHaveTextContent("LAHSA 2020 Greater Los Angeles Homeless Count");
    expect(popup).toHaveTextContent("2020 Point-in-Time count");
  });

  it("clears the selection when the selected neighborhood becomes hidden", async () => {
    // Edge case: selecting a CSA and then hiding it via the filter must not leave the highlight
    // outlining a polygon that is no longer drawn, or the card describing a now-invisible area.
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("mock-csa-click"));
    expect(await screen.findByTestId("mock-popup")).toHaveTextContent(VENICE);

    await user.click(screen.getByTestId("stub-hide-venice"));
    expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();
  });

  it("shows a hover label naming the hovered neighborhood", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("mock-csa-hover-hollywood"));

    expect(await screen.findByTestId("mock-popup")).toHaveTextContent(HOLLYWOOD);
  });

  it("suppresses the hover label for the neighborhood that is already selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("mock-csa-click"));
    expect(await screen.findByTestId("mock-popup")).toHaveTextContent(VENICE);

    // Hovering the same (already-selected) neighborhood must not add a second popup — the click
    // card is already showing that name.
    await user.click(screen.getByTestId("mock-csa-hover-venice"));
    expect(screen.getAllByTestId("mock-popup")).toHaveLength(1);
  });

  it("clears the hover label when the cursor leaves the map", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("mock-csa-hover-hollywood"));
    expect(await screen.findByTestId("mock-popup")).toHaveTextContent(HOLLYWOOD);

    await user.click(screen.getByTestId("mock-csa-mouseleave"));
    expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();
  });

  it("hides every non-District-2 label when the District 2 preset is picked", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("stub-select-cd2"));

    expect(await screen.findByTestId("stub-hidden-count")).toHaveTextContent("297");
    // The map filter hides the *complement* of the district (see `buildHiddenCsaFilter`), so the
    // district's own 7 labels must be absent from it, not present.
    const filter = JSON.parse(
      screen.getByTestId("layer-csa-fill").getAttribute("data-filter") ?? "null",
    );
    const hiddenInFilter: string[] = filter[2][1][2][1];
    expect(hiddenInFilter).toHaveLength(297);
    for (const label of COUNCIL_DISTRICTS[0].csaLabels) {
      expect(hiddenInFilter).not.toContain(label);
    }
  });

  it("unmounts the shelters layer's source when its toggle is switched off", async () => {
    const user = userEvent.setup();
    renderPage();

    // Both layers are on by default, so the shelter-points layer starts mounted...
    expect(await screen.findByTestId("layer-shelter-points")).toBeInTheDocument();

    // ...and unmounting its whole `<Source>` (not just hiding the layer) is what actually stops
    // the toggled-off layer's tile requests — see `HomelessCountPage.tsx`'s `showShelters` state.
    await user.click(screen.getByRole("checkbox", { name: "Shelters & services" }));
    expect(screen.queryByTestId("layer-shelter-points")).not.toBeInTheDocument();

    // The CSA choropleth layer is unaffected by the shelters toggle.
    expect(screen.getByTestId("layer-csa-fill")).toBeInTheDocument();
  });

  describe("311 encampment reports layer", () => {
    const TOGGLE_NAME = "311 encampment reports (CD2, 2026)";

    it("is off by default, and mounts a clustered source only once switched on", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByTestId("layer-csa-fill");

      // Off by default: the file is never requested until the layer is switched on.
      expect(screen.queryByTestId("source-encampments")).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(ENCAMPMENT_GEOJSON_PATH);

      await user.click(screen.getByRole("checkbox", { name: TOGGLE_NAME }));
      expect(await screen.findByTestId("source-encampments")).toHaveAttribute("data-source-type", "geojson");
      expect(screen.getByTestId("layer-encampment-clusters")).toBeInTheDocument();
      expect(screen.getByTestId("layer-encampment-points")).toBeInTheDocument();
      expect(screen.getByText(/Each dot is a 311 report/)).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: TOGGLE_NAME }));
      expect(screen.queryByTestId("source-encampments")).not.toBeInTheDocument();
    });

    it("opens one card listing every report stacked at the clicked point, not the CSA underneath", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("checkbox", { name: TOGGLE_NAME }));

      await user.click(screen.getByTestId("mock-encampment-click"));

      const popups = screen.getAllByTestId("mock-popup");
      expect(popups).toHaveLength(1);
      expect(popups[0]).toHaveTextContent("2 reports at this location");
      // Newest first.
      const cases = within(popups[0]).getAllByText(/-case$/).map((node) => node.textContent);
      expect(cases).toEqual(["newer-case", "older-case"]);
    });

    it("keeps encampment layers above every other layer, however late those remount", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("checkbox", { name: TOGGLE_NAME }));
      await screen.findByTestId("layer-encampment-points");
      await waitFor(() => expect(screen.getByTestId("layer-shelter-points")).toBeInTheDocument());

      expect(screen.getByTestId("layer-overlay-anchor")).not.toHaveAttribute("data-before-id");
      expect(screen.getByTestId("layer-csa-fill")).toHaveAttribute("data-before-id", "overlay-anchor");
      expect(screen.getByTestId("layer-shelter-points")).toHaveAttribute("data-before-id", "overlay-anchor");
      expect(screen.getByTestId("layer-encampment-clusters")).not.toHaveAttribute("data-before-id");
      expect(screen.getByTestId("layer-encampment-points")).not.toHaveAttribute("data-before-id");
    });

    it("opens a newly clicked stack collapsed, even after “Show all” on the previous one", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("checkbox", { name: TOGGLE_NAME }));

      await user.click(screen.getByTestId("mock-encampment-stack-click--118.36"));
      await user.click(screen.getByRole("button", { name: "Show all 6 reports" }));
      expect(within(screen.getByTestId("mock-popup")).getAllByRole("listitem")).toHaveLength(6);

      await user.click(screen.getByTestId("mock-encampment-stack-click--118.35"));
      expect(within(screen.getByTestId("mock-popup")).getAllByRole("listitem")).toHaveLength(5);
      expect(screen.getByRole("button", { name: "Show all 6 reports" })).toBeInTheDocument();
    });

    it("replaces an open CSA card, and closes when the layer is switched off", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("checkbox", { name: TOGGLE_NAME }));

      await user.click(screen.getByTestId("mock-csa-click"));
      expect(screen.getByRole("heading", { level: 2, name: VENICE })).toBeInTheDocument();

      await user.click(screen.getByTestId("mock-encampment-click"));
      expect(screen.queryByRole("heading", { level: 2, name: VENICE })).not.toBeInTheDocument();
      expect(screen.getByText("2 reports at this location")).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: TOGGLE_NAME }));
      expect(screen.queryByText("2 reports at this location")).not.toBeInTheDocument();
    });

    it("shows the month filter only while the layer is on, and feeds the map only the selected months", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByTestId("layer-csa-fill");
      const filterButton = { name: "Filter encampment reports by month filed" };
      expect(screen.queryByRole("button", filterButton)).not.toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: TOGGLE_NAME }));
      expect(await screen.findByTestId("source-encampments")).toHaveAttribute("data-feature-count", "3");

      await user.click(screen.getByRole("button", filterButton));
      await user.click(screen.getByRole("checkbox", { name: /Jan/ }));
      // Filtered on the data, not with a layer filter, so clusters can't count hidden reports.
      expect(screen.getByTestId("source-encampments")).toHaveAttribute("data-feature-count", "1");

      await user.click(screen.getByRole("checkbox", { name: TOGGLE_NAME }));
      expect(screen.queryByRole("button", filterButton)).not.toBeInTheDocument();
    });

    it("does not open a card for a cluster click — a cluster is a count, not a report", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("checkbox", { name: TOGGLE_NAME }));

      await user.click(screen.getByTestId("mock-encampment-cluster-click"));
      expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();
    });
  });

  it("restores the hidden set after the page unmounts and remounts", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
    const user = userEvent.setup();
    const { unmount } = renderPage();

    await user.click(await screen.findByTestId("stub-select-cd2"));
    expect(await screen.findByTestId("stub-hidden-count")).toHaveTextContent("297");
    unmount();

    renderPage();
    expect(await screen.findByTestId("stub-hidden-count")).toHaveTextContent("297");
  });

  describe("council district boundary layer", () => {
    const BOUNDARY_LAYER = "layer-council-district-boundary-line";
    const BOUNDARY_TOGGLE = "District 2 boundary";

    it("draws the real CD2 outline by default, and unmounts it when its toggle is switched off", async () => {
      const user = userEvent.setup();
      renderPage();

      // On by default, like the other two layers — but it appears only once the local GeoJSON
      // has resolved, so this has to wait rather than assert synchronously.
      expect(await screen.findByTestId(BOUNDARY_LAYER)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: BOUNDARY_TOGGLE })).toBeChecked();

      await user.click(screen.getByRole("checkbox", { name: BOUNDARY_TOGGLE }));
      expect(screen.queryByTestId(BOUNDARY_LAYER)).not.toBeInTheDocument();

      // Re-mounts without a second fetch of the 1.5 MB file — the loader memoizes it.
      await user.click(screen.getByRole("checkbox", { name: BOUNDARY_TOGGLE }));
      expect(await screen.findByTestId(BOUNDARY_LAYER)).toBeInTheDocument();
      const boundaryFetches = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes(COUNCIL_DISTRICTS_GEOJSON_PATH),
      );
      expect(boundaryFetches).toHaveLength(1);
    });

    it("leaves the choropleth and shelter layers alone when the boundary is toggled", async () => {
      const user = userEvent.setup();
      renderPage();

      await screen.findByTestId(BOUNDARY_LAYER);
      await user.click(screen.getByRole("checkbox", { name: BOUNDARY_TOGGLE }));

      expect(screen.getByTestId("layer-csa-fill")).toBeInTheDocument();
      expect(screen.getByTestId("layer-csa-outline")).toBeInTheDocument();
      expect(screen.getByTestId("layer-shelter-points")).toBeInTheDocument();
    });

    it("keeps the boundary mounted when the choropleth is switched off", async () => {
      // The two are independent sources: the outline is the one thing on this map that is NOT
      // derived from the CSA tiles, so it must not disappear with them.
      const user = userEvent.setup();
      renderPage();

      await screen.findByTestId(BOUNDARY_LAYER);
      await user.click(screen.getByRole("checkbox", { name: "Homeless count density" }));

      expect(screen.queryByTestId("layer-csa-fill")).not.toBeInTheDocument();
      expect(screen.getByTestId(BOUNDARY_LAYER)).toBeInTheDocument();
    });
  });

  describe("data sources section", () => {
    /** Every `<details>` entry, paired with its always-visible `<summary>`. */
    function readCollapsedEntries(container: HTMLElement) {
      return [...container.querySelectorAll<HTMLDetailsElement>("details.homeless-count-data-source")].map(
        (details) => ({
          details,
          summaryText: details.querySelector("summary")?.textContent ?? "",
        }),
      );
    }

    it("shows every source's origin while the entry is COLLAPSED", () => {
      // The explicit requirement: collapsing an entry hides its detail, never where the data
      // comes from. Nothing is expanded here — no `user.click` anywhere in this test.
      const { container } = renderPage();

      const entries = readCollapsedEntries(container);
      expect(entries).toHaveLength(DATA_SOURCES.length);

      for (const [index, source] of DATA_SOURCES.entries()) {
        const entry = entries[index];
        expect(entry.details.open).toBe(false);
        expect(entry.summaryText).toContain(source.name);
        expect(entry.summaryText).toContain(source.origin);
      }
    });

    it("names the six datasets this page actually reads, with their real origins", () => {
      // Pinned to the constants the app requests, not to prose: if `?datasets=` or a committed
      // file path changes, these fail instead of the panel quietly lying about provenance.
      const { container } = renderPage();
      const summaries = readCollapsedEntries(container).map((entry) => entry.summaryText);

      expect(summaries[0]).toContain("LAHSA 2020 Homeless Count");
      expect(summaries[0]).toContain("public/data/lahsa-2020-csa.geojson");
      expect(summaries[1]).toContain("Homeless shelters & services");
      expect(summaries[1]).toContain("?datasets=homeless_shelters_and_services");
      expect(summaries[2]).toContain("LA City Council Districts");
      expect(summaries[2]).toContain("public/data/la-city-council-districts.geojson");
      expect(summaries[3]).toContain("311 encampment reports (CD2, 2026)");
      expect(summaries[3]).toContain("public/data/cd2-encampment-reports.geojson");
      expect(summaries[4]).toContain("Neighborhood index");
      expect(summaries[4]).toContain("public/data/lahsa-2020-csa-index.json");
      expect(summaries[5]).toContain("Basemap");
      expect(summaries[5]).toContain("© OpenStreetMap contributors © CARTO");
    });

    it("reflects the Layers toggles instead of offering a second set of checkboxes", async () => {
      // The "Layers" section owns the state; this section is reference-only. A second checkbox
      // per layer is exactly the thing that can drift out of agreement.
      const { container } = renderPage();
      const section = container.querySelector(".homeless-count-data-sources");
      expect(section?.querySelectorAll("input")).toHaveLength(0);

      const entries = readCollapsedEntries(container);
      expect(entries[0].summaryText).toContain("Shown");

      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: "Homeless count density" }));
      expect(readCollapsedEntries(container)[0].summaryText).toContain("Hidden");
    });

    it("marks the two non-layer sources as having nothing to toggle", () => {
      const { container } = renderPage();
      const entries = readCollapsedEntries(container);

      expect(entries[4].summaryText).toContain("Not a map layer");
      expect(entries[5].summaryText).toContain("Always on");
    });
  });

  describe("map info panel", () => {
    it("is not open on first render", () => {
      renderPage();

      expect(screen.getByRole("button", { name: "Info" })).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("region", { name: "About this map" })).not.toBeInTheDocument();
    });

    it("opens on the info button and explains each layer in plain language", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole("button", { name: "Info" }));

      const panel = screen.getByRole("region", { name: "About this map" });
      expect(panel).toHaveTextContent("2020 Point-in-Time count");
      expect(panel).toHaveTextContent("per square mile");
      expect(panel).toHaveTextContent("Shelters and service locations");
      expect(panel).toHaveTextContent("Council District 2 boundary");
      // Plumbing detail belongs in the left panel, not in a staffer-facing orientation card.
      expect(panel.textContent).not.toContain("http");
      expect(panel.textContent).not.toContain("zoom level");
    });

    it("closes on the close button and returns focus to the info button", async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole("button", { name: "Info" });
      await user.click(trigger);
      await user.click(screen.getByRole("button", { name: "Close about this map" }));

      expect(screen.queryByRole("region", { name: "About this map" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it("closes on Escape and returns focus to the info button", async () => {
      const user = userEvent.setup();
      renderPage();

      const trigger = screen.getByRole("button", { name: "Info" });
      await user.click(trigger);
      expect(screen.getByRole("region", { name: "About this map" })).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("region", { name: "About this map" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  describe("district readout", () => {
    // The real 7-row District 2 preset, straight from the shipped index — see the module-level
    // node calculation that produced these numbers (public/data/lahsa-2020-csa-index.json).
    const CD2_ROWS: Array<[displayName: string, totalPop: string]> = [
      ["North Hollywood", "1,291"],
      ["Studio City", "89"],
      ["Sun Valley", "902"],
      ["Toluca Lake", "46"],
      ["Valley Glen", "29"],
      ["Valley Village", "69"],
      ["Van Nuys", "549"],
    ];

    it("lists all 7 District 2 neighborhoods with their static Total_Pop", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
      renderPage();

      expect(await screen.findByRole("heading", { name: "District 2" })).toBeInTheDocument();

      for (const [name, total] of CD2_ROWS) {
        const row = screen.getByText(name).closest("button");
        expect(row).not.toBeNull();
        expect(row).toHaveTextContent(total);
      }
    });

    it("selects a neighborhood, opening its card and the orange highlight, when its readout row is clicked", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("heading", { name: "District 2" });
      expect(screen.queryByTestId("mock-popup")).not.toBeInTheDocument();

      await user.click(screen.getByText("North Hollywood"));

      // Opens the detail card exactly as a polygon click would (via the shared `selectCsa`
      // path), just without a live tile feature to read from in this test's mocked map.
      const popup = await screen.findByTestId("mock-popup");
      expect(popup).toHaveTextContent("Los Angeles - North Hollywood");
      expect(popup).toHaveTextContent("1,291");

      // ...and triggers the same orange highlight layer a polygon click triggers.
      const highlightFilter = JSON.parse(
        screen.getByTestId("layer-csa-highlight").getAttribute("data-filter") ?? "null",
      );
      expect(highlightFilter).toEqual(["==", ["get", "CSA_Label"], "Los Angeles - North Hollywood"]);
    });

    it("never renders a summed total across the district's rows", async () => {
      // LAHSA's own service metadata: "LAHSA does not recommend aggregating census tract-level
      // data to calculate numbers for other geographic levels." 2,975 is the sum of the 7 rows
      // above (1291+89+902+46+29+69+549) and must never appear anywhere on the page.
      fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(shippedIndexPayload))));
      renderPage();

      await screen.findByRole("heading", { name: "District 2" });
      expect(screen.queryByText("2,975")).not.toBeInTheDocument();
    });
  });
});
