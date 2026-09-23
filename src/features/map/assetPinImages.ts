import { useEffect, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

import { ASSET_PIN_IMAGE_IDS, CATEGORY_ORDER } from "./neighborhoodMapLayers";

/**
 * Registers the four category pin icons with the MapLibre style so a symbol layer can draw them.
 *
 * The pins stay inside the WebGL canvas rather than becoming React `<Marker>`s. That is the same
 * call `neighborhoodMapLayers.ts` records for the circles they replace: a Marker per pin is 68
 * DOM nodes for something that needs a picture and a click, and is why `useMapData` has to cap
 * project markers at 100. Swapping a circle layer for a symbol layer keeps the category filter,
 * the hover layer and the selection layer working unchanged.
 *
 * SVG needs rasterising first -- `map.addImage` takes bitmaps, not markup, and MapLibre's own
 * `loadImage` does not decode SVG. Each file is drawn into a canvas at `PIN_RENDER_PX`, which is
 * the artwork plus its shadow margin times a 2x pixel ratio, so the icon stays sharp on a retina
 * display and `icon-size` still reasons in CSS pixels.
 *
 * Note for anyone sizing the layers: registering at `pixelRatio: 2` means MapLibre treats the
 * raster as half its width in CSS px, and `icon-size` scales every source pixel alike. So
 * `ICON_RENDER_PX` in `neighborhoodMapLayers.ts`, which the pin and circle sizes are derived
 * from, tracks PIN_SOURCE_PX -- the artwork -- not PIN_BOX_PX and not PIN_RENDER_PX.
 */

/** Source artwork is 66x66; 2x covers retina without shipping a second set of files. */
const PIN_PIXEL_RATIO = 2;
export const PIN_SOURCE_PX = 66;
/** The CSS shadow this bakes in: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))`. */
export const PIN_SHADOW_BLUR_PX = 4;
export const PIN_SHADOW_OFFSET_Y_PX = 2;

/**
 * Margin around the artwork for the baked shadow: the blur's own reach (a 4px radius is twice
 * the 2px Gaussian deviation, so the tail dies out ~2 deviations past it) plus the drop.
 * Derived rather than hardcoded — at 8px the tail lands exactly on the canvas edge, so a later
 * blur increase would clip the shadow with nothing to catch it.
 *
 * Applied on all four sides rather than only where the shadow falls, because a symbol is
 * anchored by its centre and an asymmetric margin would walk every pin off its coordinate.
 */
const PIN_SHADOW_PAD_PX = PIN_SHADOW_BLUR_PX + PIN_SHADOW_OFFSET_Y_PX + 2;
/** What MapLibre sees as the image's CSS width: the artwork plus that margin. */
export const PIN_BOX_PX = PIN_SOURCE_PX + PIN_SHADOW_PAD_PX * 2;
export const PIN_RENDER_PX = PIN_BOX_PX * PIN_PIXEL_RATIO;

/** Category -> the artwork behind its icon id. Ids live in `neighborhoodMapLayers.ts`. */
export const ASSET_PIN_SOURCES: Record<string, string> = {
  "NEIGHBORHOOD ORGANIZATIONS AND RESOURCES": "images/pins/orgs-rcs.svg",
  "RECREATION & PARKS": "images/pins/rec-parks.svg",
  "PUBLIC SAFETY": "images/pins/pub-saf.svg",
  "DISTRICT PROJECTS & OFFICE": "images/pins/dist-prjs.svg",
};

/** The pairs the loader walks: one icon id, one file. */
export function assetPinImageEntries(): { id: string; src: string }[] {
  return CATEGORY_ORDER.map((category) => ({
    id: ASSET_PIN_IMAGE_IDS[category],
    src: ASSET_PIN_SOURCES[category],
  }));
}

/** Same URL construction as cd2Assets.ts, so BASE_URL is honoured on a subpath deploy. */
export function pinImageUrl(src: string): string {
  return new URL(src, window.location.origin + import.meta.env.BASE_URL).toString();
}

/** Every category has both an id and a file, or the symbol layer draws a blank for it. */
export function assertPinImagesAreTotal(): void {
  const missing = CATEGORY_ORDER.filter(
    (category) => !ASSET_PIN_IMAGE_IDS[category] || !ASSET_PIN_SOURCES[category],
  );
  if (missing.length > 0) {
    throw new Error(`no pin image for category: ${missing.join(", ")}`);
  }
}

const PIN_ARTWORK_RASTER_PX = PIN_SOURCE_PX * PIN_PIXEL_RATIO;
const PIN_SHADOW_PAD_RASTER_PX = PIN_SHADOW_PAD_PX * PIN_PIXEL_RATIO;

function rasterize(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Explicit width/height: an SVG with no intrinsic size would otherwise rasterise at the
    // browser's default 300x150 and come out stretched.
    image.width = PIN_ARTWORK_RASTER_PX;
    image.height = PIN_ARTWORK_RASTER_PX;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PIN_RENDER_PX;
      canvas.height = PIN_RENDER_PX;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("no 2d context for pin rasterisation"));
        return;
      }
      // The council-file pins take their shadow from a CSS filter, which never reaches a symbol
      // layer, so `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))` is painted into the raster
      // instead. CSS's blur radius and canvas's `shadowBlur` both mean twice the Gaussian
      // deviation, so the 4 carries over unchanged; both it and the 2px drop are then scaled by
      // the pixel ratio because the canvas is in device pixels.
      context.shadowColor = "rgba(0, 0, 0, 0.25)";
      context.shadowBlur = PIN_SHADOW_BLUR_PX * PIN_PIXEL_RATIO;
      context.shadowOffsetY = PIN_SHADOW_OFFSET_Y_PX * PIN_PIXEL_RATIO;
      context.drawImage(
        image,
        PIN_SHADOW_PAD_RASTER_PX,
        PIN_SHADOW_PAD_RASTER_PX,
        PIN_ARTWORK_RASTER_PX,
        PIN_ARTWORK_RASTER_PX,
      );
      resolve(context.getImageData(0, 0, PIN_RENDER_PX, PIN_RENDER_PX));
    };
    image.onerror = () => reject(new Error(`pin image failed to load: ${src}`));
    image.src = pinImageUrl(src);
  });
}

interface AddImageTarget {
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: ImageData, options?: { pixelRatio?: number }) => void;
}

/**
 * Idempotent: `hasImage` is checked first because the style survives re-renders and re-adding an
 * existing id makes MapLibre throw.
 */
export async function addAssetPinImages(map: AddImageTarget): Promise<void> {
  assertPinImagesAreTotal();
  await Promise.all(
    assetPinImageEntries().map(async ({ id, src }) => {
      if (map.hasImage(id)) {
        return;
      }
      const data = await rasterize(src);
      // Re-checked after the await: two overlapping loads would otherwise both pass the first
      // check and the second addImage would throw.
      if (!map.hasImage(id)) {
        map.addImage(id, data, { pixelRatio: PIN_PIXEL_RATIO });
      }
    }),
  );
}

/**
 * `false` until every icon is registered. The symbol layer is not mounted before that, because a
 * layer whose `icon-image` names an id the style does not have yet warns on every frame.
 *
 * `enabled` is gated on the overlay toggle, so a session that never turns it on never fetches
 * the four files -- the same shape as `useDistrictAssets(districtId, enabled)`.
 */
export function useAssetPinImages(mapRef: { current: MapRef | null }, enabled: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!enabled || !map) {
      return;
    }
    let ignore = false;
    void addAssetPinImages(map as unknown as AddImageTarget)
      .then(() => {
        if (!ignore) {
          setReady(true);
        }
      })
      .catch(() => {
        // Silent, like useDistrictAssets: a failed icon load must not take the map down. The
        // layer stays unmounted and the overlay renders its outlines without pins.
        if (!ignore) {
          setReady(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [mapRef, enabled]);

  return ready;
}
