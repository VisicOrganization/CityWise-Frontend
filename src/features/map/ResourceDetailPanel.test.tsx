import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assetKey, type AssetCollection, type AssetProperties } from "./cd2Assets";
import { ASSET_FLASH_MS, ResourceDetailPanel } from "./ResourceDetailPanel";

afterEach(cleanup);

function asset(properties: Partial<AssetProperties>) {
  return {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [-118.4, 34.16] },
    properties: {
      label: "Unnamed",
      category: "RECREATION & PARKS",
      neighborhood: "Studio City",
      precision: "rooftop" as const,
      ...properties,
    },
  };
}

function collection(features: ReturnType<typeof asset>[]): AssetCollection {
  return { type: "FeatureCollection", features };
}

const STUDIO_CITY = { kind: "neighborhood", csaLabel: "Los Angeles - Studio City" } as const;
const DISTRICT = { kind: "district" } as const;

function renderPanel(props: Partial<Parameters<typeof ResourceDetailPanel>[0]> = {}) {
  return render(
    <ResourceDetailPanel
      selection={STUDIO_CITY}
      assets={collection([asset({ label: "Beeman Park" })])}
      districtId={2}
      onClose={() => {}}
      {...props}
    />,
  );
}

describe("ResourceDetailPanel, neighborhood selection", () => {
  it("titles the panel with the short neighborhood name", () => {
    renderPanel();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Studio City");
  });

  // The build merges a facility the sheet lists once per neighbourhood it serves into one pin
  // whose `neighborhood` becomes the literal "Multiple neighborhoods". Matching that field
  // alone would hide the police station from every neighbourhood it actually serves.
  it("includes pins that only reach the neighborhood through `serves`", () => {
    renderPanel({
      selection: { kind: "neighborhood", csaLabel: "Los Angeles - Valley Glen" },
      assets: collection([
        asset({
          label: "Van Nuys Community Police Station",
          category: "PUBLIC SAFETY",
          neighborhood: "Multiple neighborhoods",
          serves: "Valley Glen, Van Nuys",
        }),
      ]),
    });

    expect(screen.getByText("Van Nuys Community Police Station")).toBeTruthy();
    expect(screen.getByText(/1 resource serving this neighborhood/)).toBeTruthy();
  });

  // "Valley Glen" must not pull in "Valley Village" just because one string contains the other.
  it("matches `serves` entries whole, not as substrings", () => {
    renderPanel({
      selection: { kind: "neighborhood", csaLabel: "Los Angeles - Valley Glen" },
      assets: collection([asset({ label: "Valley Village Park", neighborhood: "Valley Village" })]),
    });

    expect(screen.queryByText("Valley Village Park")).toBeNull();
    expect(screen.getByText(/No resources are listed/)).toBeTruthy();
  });

  // The 16 district-level rows are identical across all seven panels; they have their own.
  it("leaves Districtwide pins out", () => {
    renderPanel({
      assets: collection([
        asset({ label: "Beeman Park" }),
        asset({
          label: "Vineland Avenue Median",
          neighborhood: "Districtwide",
          category: "DISTRICT PROJECTS & OFFICE",
        }),
      ]),
    });

    expect(screen.getByText("Beeman Park")).toBeTruthy();
    expect(screen.queryByText("Vineland Avenue Median")).toBeNull();
    expect(screen.getByText(/1 resource serving this neighborhood/)).toBeTruthy();
  });

  it("groups cards under their category heading and drops empty categories", () => {
    renderPanel({
      assets: collection([
        asset({ label: "Beeman Park", category: "RECREATION & PARKS" }),
        asset({
          label: "Studio City Neighborhood Council",
          category: "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES",
        }),
      ]),
    });

    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings).toHaveLength(2);
    // CATEGORY_ORDER, not alphabetical or data order: the panel's sections and the map legend
    // must stay in the same sequence.
    expect(headings[0]).toContain("Neighborhood orgs & resources");
    expect(headings[1]).toContain("Recreation & parks");
    expect(headings.some((text) => text?.includes("Public safety"))).toBe(false);
  });

  it("renders only the contact fields a pin actually carries", () => {
    renderPanel({
      assets: collection([
        asset({ label: "Beeman Park", phone: "(818) 769-4415", address: "10639 Hortense St." }),
      ]),
    });

    expect(screen.getByText("Phone")).toBeTruthy();
    expect(screen.getByText("10639 Hortense St.")).toBeTruthy();
    expect(screen.queryByText("Email")).toBeNull();
    expect(screen.queryByText("Website")).toBeNull();
  });

  it("links the neighborhood page from the sheet's source_url", () => {
    renderPanel({ sourceUrl: "https://cd2.lacity.gov/district-2/studio-city" });

    const link = screen.getByRole("link", { name: "cd2.lacity.gov/district-2/studio-city" });
    expect(link.getAttribute("href")).toBe("https://cd2.lacity.gov/district-2/studio-city");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  // A missing source_url must stay visible rather than silently removing the row -- it means
  // the sheet lost a value, which someone has to notice.
  it("shows a labelled blank when no source_url reached the panel", () => {
    renderPanel({ sourceUrl: null });
    expect(screen.getByText("Neighborhood page")).toBeTruthy();
    expect(screen.getByText("Not provided")).toBeTruthy();
  });

  it("calls onClose from the header close button", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "Close Studio City panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Two genuinely different points share the name "South Weddington Park" in the real data.
  // A label-only React key would collide and the flash would land on the wrong card.
  it("keeps same-named pins in different neighborhoods apart", () => {
    renderPanel({
      selection: { kind: "neighborhood", csaLabel: "Los Angeles - Toluca Lake" },
      assets: collection([
        asset({ label: "South Weddington Park", neighborhood: "Studio City" }),
        asset({ label: "South Weddington Park", neighborhood: "Toluca Lake" }),
      ]),
    });

    expect(screen.getAllByText("South Weddington Park")).toHaveLength(1);
  });
});

describe("ResourceDetailPanel, district selection", () => {
  const districtAssets = collection([
    asset({
      label: "Chandler Bike Path",
      category: "DISTRICT PROJECTS & OFFICE",
      neighborhood: "Districtwide",
    }),
    asset({
      label: "Tujunga Green Belt",
      category: "DISTRICT PROJECTS & OFFICE",
      neighborhood: "Multiple neighborhoods",
      serves: "Districtwide, Valley Glen",
    }),
    asset({ label: "Beeman Park", neighborhood: "Studio City" }),
  ]);

  it("is titled District-wide resources and scoped to the council district", () => {
    renderPanel({ selection: DISTRICT, assets: districtAssets });

    // Deliberately not "District Overview" -- DistrictOverviewSheet owns that name.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("District-wide resources");
    expect(screen.getByLabelText("District-wide resources")).toBeTruthy();
    expect(screen.getByText("Council District 2")).toBeTruthy();
  });

  // Selected by category, not by `neighborhood === "Districtwide"`, so that every pin drawn in
  // that colour is findable in the panel its click opens.
  it("holds the whole District projects & office category and nothing else", () => {
    renderPanel({ selection: DISTRICT, assets: districtAssets });

    expect(screen.getByText("Chandler Bike Path")).toBeTruthy();
    expect(screen.getByText("Tujunga Green Belt")).toBeTruthy();
    expect(screen.queryByText("Beeman Park")).toBeNull();
    expect(screen.getByText(/2 resources across the district/)).toBeTruthy();
  });

  it("drops the group heading when there is only one category to show", () => {
    renderPanel({ selection: DISTRICT, assets: districtAssets });
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("labels its link row District page and uses the district's own source_url", () => {
    renderPanel({
      selection: DISTRICT,
      assets: districtAssets,
      sourceUrl: "https://cd2.lacity.gov/district-2",
    });

    expect(screen.queryByText("Neighborhood page")).toBeNull();
    expect(screen.getByText("District page")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "cd2.lacity.gov/district-2" }).getAttribute("href"),
    ).toBe("https://cd2.lacity.gov/district-2");
  });
});

describe("ResourceDetailPanel scroll-to and flash", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView.mockClear();
    // jsdom does not implement it; the component guards on typeof, so it must exist to be called.
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const beeman = { label: "Beeman Park", neighborhood: "Studio City", category: "RECREATION & PARKS" };
  const assets = collection([
    asset(beeman),
    asset({ label: "Wilacre Park", neighborhood: "Studio City", category: "RECREATION & PARKS" }),
  ]);

  function cardFor(label: string) {
    return screen.getByText(label).closest("li") as HTMLLIElement;
  }

  it("scrolls the focused card into view and flashes it green for one second", () => {
    renderPanel({ assets, focus: { key: assetKey(beeman), nonce: 1 } });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(cardFor("Beeman Park").className).toContain("is-flashing");
    expect(cardFor("Wilacre Park").className).not.toContain("is-flashing");

    act(() => {
      vi.advanceTimersByTime(ASSET_FLASH_MS);
    });

    expect(cardFor("Beeman Park").className).not.toContain("is-flashing");
  });

  // A second click on the same pin has the same key, so without the nonce React would see
  // unchanged deps and skip the effect, leaving the click with no feedback.
  it("re-flashes when the same pin is clicked again", () => {
    const { rerender } = renderPanel({ assets, focus: { key: assetKey(beeman), nonce: 1 } });

    act(() => {
      vi.advanceTimersByTime(ASSET_FLASH_MS);
    });
    expect(cardFor("Beeman Park").className).not.toContain("is-flashing");

    rerender(
      <ResourceDetailPanel
        selection={STUDIO_CITY}
        assets={assets}
        focus={{ key: assetKey(beeman), nonce: 2 }}
        districtId={2}
        onClose={() => {}}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(cardFor("Beeman Park").className).toContain("is-flashing");
  });

  it("flashes nothing when the panel was opened without a pin click", () => {
    const { container } = renderPanel({ assets, focus: null });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".is-flashing")).toHaveLength(0);
  });

  it("skips smooth scrolling when the viewer asked for reduced motion", () => {
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
    } as unknown as MediaQueryList);

    renderPanel({ assets, focus: { key: assetKey(beeman), nonce: 1 } });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });
});

describe("ResourceDetailPanel card selection", () => {
  const beeman = {
    label: "Beeman Park",
    neighborhood: "Studio City",
    category: "RECREATION & PARKS",
    phone: "(818) 769-4415",
    website: "https://www.laparks.org/park/beeman",
  };

  it("hands the clicked card's pin, with its coordinates, back to the map", async () => {
    const onSelectAsset = vi.fn();
    renderPanel({ assets: collection([asset(beeman)]), onSelectAsset });

    await userEvent.click(screen.getByText("Beeman Park"));

    expect(onSelectAsset).toHaveBeenCalledTimes(1);
    expect(onSelectAsset.mock.calls[0][0]).toMatchObject({
      key: assetKey(beeman),
      longitude: -118.4,
      latitude: 34.16,
    });
  });

  it("selects the card from anywhere on it, not just the title", async () => {
    const onSelectAsset = vi.fn();
    renderPanel({ assets: collection([asset(beeman)]), onSelectAsset });

    await userEvent.click(screen.getByText("Phone"));
    expect(onSelectAsset).toHaveBeenCalledTimes(1);
  });

  // A click aimed at tel:/mailto:/the website is a click on that link, not a request to move
  // the map. Without this the map would jump out from under a tap on a phone number.
  it("does not move the map when a link inside the card is clicked", async () => {
    const onSelectAsset = vi.fn();
    renderPanel({ assets: collection([asset(beeman)]), onSelectAsset });

    await userEvent.click(screen.getByRole("link", { name: "(818) 769-4415" }));
    await userEvent.click(screen.getByRole("link", { name: "www.laparks.org/park/beeman" }));

    expect(onSelectAsset).not.toHaveBeenCalled();
  });

  it("exposes the same action to the keyboard through the title button", async () => {
    const onSelectAsset = vi.fn();
    renderPanel({ assets: collection([asset(beeman)]), onSelectAsset });

    const button = screen.getByRole("button", { name: "Show Beeman Park on the map" });
    button.focus();
    await userEvent.keyboard("{Enter}");

    expect(onSelectAsset).toHaveBeenCalledTimes(1);
  });

  it("renders plain, unclickable cards when no handler is supplied", () => {
    renderPanel({ assets: collection([asset(beeman)]) });

    expect(screen.queryByRole("button", { name: /Show Beeman Park/ })).toBeNull();
    expect(screen.getByText("Beeman Park").closest("li")?.className).not.toContain("is-selectable");
  });
});
