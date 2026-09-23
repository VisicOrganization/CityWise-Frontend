import type { CircleLayerSpecification, ExpressionSpecification } from "maplibre-gl";

/**
 * Scout vector tiles carrying LAHSA-adjacent shelter and service point locations, sibling to the
 * CSA polygon dataset in `csaLayers.ts`.
 *
 * Unkeyed and CORS-open (`access-control-allow-origin: *`, `cache-control: public, max-age=3600`),
 * so the URL is hardcoded rather than externalised: there is no key to hide.
 * `?datasets=homeless_shelters_and_services` selects this point layer alone;
 * see `HomelessCountPage.tsx` for why it is requested as its own tile rather than combined with
 * the CSA dataset. (Endpoint and attribute names verified against the live service 2026-09-19.)
 */
export const SHELTER_TILES_URL =
  "https://scout.geosolvix.com/api/basemap/{z}/{x}/{y}?datasets=homeless_shelters_and_services";

/** Source-layer name inside the tile. One wrong character blanks the layer with no error. */
export const SHELTER_SOURCE_LAYER = "homeless_shelters_and_services";

/**
 * Highest zoom the tile server actually builds for this dataset. The vendor's own integration
 * snippet claims 14, but that is wrong: z13 through z16 all return HTTP 204 (empty) against the
 * live service — an undocumented tile-server ceiling that silently blanks the layer past it, with
 * no error to catch. Declaring 12 lets MapLibre overzoom the z12 tile instead, which renders
 * correctly at any zoom; declaring 14 would silently blank the layer the moment a user zooms in
 * past 12.
 */
export const SHELTER_TILE_MAX_ZOOM = 12;

/**
 * Feature counts measured in the tile covering central LA (verified 2026-09-19): z6=1, z8=4,
 * z10=16, z12=40. The server decimates heavily at low zoom — a user viewing the county at z8
 * would see 4 points where 40 actually exist at that spot. `HomelessCountPage` surfaces
 * `SHELTER_LOW_ZOOM_NOTE` near the legend whenever this layer is on so that under-representation
 * isn't mistaken for the real count.
 */
export const SHELTER_LOW_ZOOM_FEATURE_COUNTS = { z6: 1, z8: 4, z10: 16, z12: 40 } as const;

/** Always-present, one-line copy — deliberately not gated behind any zoom-threshold check. */
export const SHELTER_LOW_ZOOM_NOTE =
  "Not every shelter or service location appears at this zoom level — zoom in to see the full set.";

// No `SHELTER_ATTRIBUTION` const: unlike the CSA dataset's ArcGIS service, this endpoint's
// response carries no `copyrightText` (or equivalent) that was verified live, and inventing
// attribution text would be worse than omitting it.

/**
 * Sits on top of `csaFillLayer`'s green sequential choropleth (`#c7e9c0` → `#00441b` at the dark
 * end), so the fill has to stay legible over the darkest fill class, not just the palest.
 *
 * `#1d4ed8` is blue — the hue the choropleth gave up when it went green. These points used to be
 * the repo's brand forest green (`#1d865e`, the searched-address pin in `CityMap.tsx`), which
 * worked over a blue ramp and disappears into a green one: a dot cannot be told from the polygon
 * it stands on when both are the same hue, whatever their lightness. Blue is far enough from
 * every ramp step to read as a distinct mark at both ends, and dark enough not to wash out over
 * the palest class. A white stroke separates the marker from the fill at both ends of the ramp,
 * the same role `csaOutlineLayer` plays for polygon edges.
 *
 * Radius grows modestly with zoom via `interpolate`: point-in-time markers are location
 * indicators, not the analytical content, so they should stay readable at a glance rather than
 * dominate the map — z7 (county-scale browsing) gets a small dot, z12 (block-scale) gets one
 * comfortably clickable without ballooning over multiple building footprints.
 */
export const shelterPointLayer: Omit<CircleLayerSpecification, "source"> = {
  id: "shelter-points",
  type: "circle",
  paint: {
    "circle-color": "#1d4ed8",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      7,
      3,
      12,
      7,
    ] as unknown as ExpressionSpecification,
  },
};
