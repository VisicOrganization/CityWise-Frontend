import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ASSET_PIN_SOURCES,
  addAssetPinImages,
  assertPinImagesAreTotal,
  assetPinImageEntries,
  PIN_BOX_PX,
  PIN_RENDER_PX,
  PIN_SHADOW_BLUR_PX,
  PIN_SHADOW_OFFSET_Y_PX,
  PIN_SOURCE_PX,
  pinImageUrl,
} from "./assetPinImages";
import { ASSET_PIN_IMAGE_IDS, CATEGORY_ORDER, ICON_RENDER_PX } from "./neighborhoodMapLayers";

/**
 * jsdom has no canvas 2d context and never fires load on an SVG `Image`, so both are stubbed.
 * The stub records what was asked for; the assertions are about the loader's contract, not
 * about pixels.
 */
const loadedSrcs: string[] = [];
/** Flipped by the failure test; the stub then fires onerror instead of onload. */
let imagesFail = false;

class StubImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";

  set src(value: string) {
    this.#src = value;
    loadedSrcs.push(value);
    queueMicrotask(() => {
      if (imagesFail) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }

  get src() {
    return this.#src;
  }
}

function stubCanvas(context: unknown) {
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") {
      return Object.create(HTMLElement.prototype) as HTMLElement;
    }
    return { width: 0, height: 0, getContext: () => context } as unknown as HTMLElement;
  }) as typeof document.createElement);
}

const drawImage = vi.fn();
const getImageData = vi.fn(() => ({ width: PIN_RENDER_PX, height: PIN_RENDER_PX }) as ImageData);
/** Shared so the shadow test can read back what the loader set on it — and cleared in
 * `beforeEach` below, so one test's shadow state cannot stand in for another's. */
const context = { drawImage, getImageData } as unknown as CanvasRenderingContext2D;

function resetContext() {
  const mutable = context as unknown as Record<string, unknown>;
  delete mutable.shadowColor;
  delete mutable.shadowBlur;
  delete mutable.shadowOffsetY;
}

function fakeMap(existing: string[] = []) {
  const images = new Set(existing);
  return {
    images,
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string, _image: ImageData, _options?: { pixelRatio?: number }) => {
      if (images.has(id)) {
        throw new Error(`image ${id} already exists`);
      }
      images.add(id);
    }),
  };
}

beforeEach(() => {
  loadedSrcs.length = 0;
  imagesFail = false;
  drawImage.mockClear();
  getImageData.mockClear();
  resetContext();
  vi.stubGlobal("Image", StubImage);
  stubCanvas(context);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pin image registry", () => {
  // A category with no icon would make the symbol layer draw a blank where a pin should be.
  it("covers every category with both an id and a file", () => {
    expect(() => assertPinImagesAreTotal()).not.toThrow();
    for (const category of CATEGORY_ORDER) {
      expect(ASSET_PIN_SOURCES[category]).toMatch(/^images\/pins\/.+\.svg$/);
      expect(ASSET_PIN_IMAGE_IDS[category]).toBeTruthy();
    }
  });

  it("pairs each id with its own file, with no id or file reused", () => {
    const entries = assetPinImageEntries();
    expect(entries).toHaveLength(CATEGORY_ORDER.length);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.src)).size).toBe(entries.length);
  });

  /**
   * The link between the two files: `icon-size: 1` draws PIN_SOURCE_PX CSS pixels, because
   * MapLibre divides the raster by the pixelRatio it was registered with. If this drifts, every
   * pin renders at the wrong size and nothing else fails.
   */
  it("registers at a size that makes icon-size 1 equal ICON_RENDER_PX", () => {
    // The registered image is the padded box, but icon-size scales every source pixel alike, so
    // it is the artwork inside it that the layers divide by.
    expect(PIN_SOURCE_PX).toBe(ICON_RENDER_PX);
    // The margin has to outlast the shadow it exists for, or the tail is clipped at the canvas
    // edge — invisible in a unit test and easy to introduce by nudging the blur. Stated as the
    // requirement (3σ past the drop, and canvas blur is 2σ) rather than by importing the pad, so
    // replacing the derivation with a literal is what this catches.
    const reachPerSide = PIN_SHADOW_BLUR_PX * 1.5 + PIN_SHADOW_OFFSET_Y_PX;
    expect(PIN_BOX_PX - PIN_SOURCE_PX).toBeGreaterThanOrEqual(2 * reachPerSide);
  });

  // Same URL construction as the geojson loads, so a subpath deploy resolves the artwork.
  it("resolves sources against BASE_URL rather than the current route", () => {
    expect(pinImageUrl("images/pins/rec-parks.svg")).toBe(
      new URL("images/pins/rec-parks.svg", window.location.origin + import.meta.env.BASE_URL).toString(),
    );
  });
});

describe("addAssetPinImages", () => {
  it("rasterises each icon once and registers it at a 2x pixel ratio", async () => {
    const map = fakeMap();
    await addAssetPinImages(map);

    expect(map.addImage).toHaveBeenCalledTimes(CATEGORY_ORDER.length);
    for (const category of CATEGORY_ORDER) {
      expect(map.images.has(ASSET_PIN_IMAGE_IDS[category])).toBe(true);
    }
    expect(map.addImage.mock.calls[0][2]).toEqual({ pixelRatio: 2 });
    // Explicit size, or an SVG with no intrinsic dimensions rasterises at jsdom's default. Drawn
    // inset by the shadow margin, centred, so the disc still sits on the pin's coordinate.
    const artworkPx = PIN_SOURCE_PX * 2;
    const insetPx = (PIN_RENDER_PX - artworkPx) / 2;
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      insetPx,
      insetPx,
      artworkPx,
      artworkPx,
    );
  });

  // The council-file pins take `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))` from CSS, which
  // never reaches a symbol layer, so the same shadow has to be in the bitmap -- at 2x, because
  // the canvas is in device pixels.
  it("bakes the council-file pins' drop shadow into the raster", async () => {
    await addAssetPinImages(fakeMap());

    expect(context.shadowColor).toBe("rgba(0, 0, 0, 0.25)");
    expect(context.shadowBlur).toBe(8);
    expect(context.shadowOffsetY).toBe(4);
  });

  // The style survives re-renders, and MapLibre throws on a duplicate id, so a second call has
  // to be a no-op rather than an error.
  it("is idempotent across repeated calls", async () => {
    const map = fakeMap();
    await addAssetPinImages(map);
    await addAssetPinImages(map);
    await addAssetPinImages(map);

    expect(map.addImage).toHaveBeenCalledTimes(CATEGORY_ORDER.length);
  });

  it("skips icons the style already carries", async () => {
    const map = fakeMap([ASSET_PIN_IMAGE_IDS[CATEGORY_ORDER[0]]]);
    await addAssetPinImages(map);

    expect(map.addImage).toHaveBeenCalledTimes(CATEGORY_ORDER.length - 1);
  });

  it("rejects when an icon file cannot be loaded", async () => {
    imagesFail = true;
    await expect(addAssetPinImages(fakeMap())).rejects.toThrow(/failed to load/);
  });

  // Every icon is requested through pinImageUrl, so a subpath deploy fetches all four.
  it("requests each icon from its BASE_URL-resolved location", async () => {
    await addAssetPinImages(fakeMap());
    expect(loadedSrcs.sort()).toEqual(
      assetPinImageEntries()
        .map((entry) => pinImageUrl(entry.src))
        .sort(),
    );
  });

  it("rejects when the canvas has no 2d context", async () => {
    stubCanvas(null);
    await expect(addAssetPinImages(fakeMap())).rejects.toThrow(/2d context/);
  });
});
