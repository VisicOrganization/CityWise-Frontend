import type { StyleSpecification } from "maplibre-gl";

import { cartoLightAllTilesUrl } from "./cartoBasemap";

/**
 * Shared light basemap for every map surface (city map, homeless-count map).
 *
 * Kept as a `const` rather than a factory on purpose: `cartoLightAllTilesUrl()` is meant to
 * resolve once at module-eval time, and a factory would both change that timing and force an
 * edit at each use site. Single definition also means a CARTO key fix lands on every map at
 * once — a divergent copy fails silently as a watermarked or blank basemap that no test catches.
 */
export const LIGHT_BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    raster: {
      type: "raster",
      tiles: [cartoLightAllTilesUrl()],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#eef2f5",
      },
    },
    {
      id: "raster-base",
      type: "raster",
      source: "raster",
      paint: {
        "raster-opacity": 0.97,
        "raster-saturation": -0.18,
      },
    },
  ],
};
