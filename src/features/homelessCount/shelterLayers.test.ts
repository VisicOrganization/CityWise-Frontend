import { describe, expect, it } from "vitest";

import {
  SHELTER_SOURCE_LAYER,
  SHELTER_TILES_URL,
  SHELTER_TILE_MAX_ZOOM,
  shelterPointLayer,
} from "./shelterLayers";

describe("shelterLayers", () => {
  it("pins the undocumented Scout tile contract", () => {
    // A rename on either of these blanks the layer with no error, so they are asserted verbatim.
    expect(SHELTER_TILES_URL).toBe(
      "https://scout.geosolvix.com/api/basemap/{z}/{x}/{y}?datasets=homeless_shelters_and_services",
    );
    expect(SHELTER_SOURCE_LAYER).toBe("homeless_shelters_and_services");
    // The vendor snippet claims maxzoom 14, but z13+ return HTTP 204 against the live service —
    // declaring 14 would blank the layer once a user zoomed in past 12.
    expect(SHELTER_TILE_MAX_ZOOM).toBe(12);
  });

  it("renders shelter points in blue with a white separating stroke", () => {
    // Not green: the choropleth underneath is a green ramp now, and a dot cannot be told apart
    // from the polygon it stands on when the two share a hue (see `shelterPointLayer`).
    expect(shelterPointLayer.id).toBe("shelter-points");
    expect(shelterPointLayer.paint?.["circle-color"]).toBe("#1d4ed8");
    expect(shelterPointLayer.paint?.["circle-stroke-color"]).toBe("#ffffff");
  });

  it("grows the point radius with zoom rather than holding it constant", () => {
    expect(shelterPointLayer.paint?.["circle-radius"]).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      7,
      3,
      12,
      7,
    ]);
  });
});
