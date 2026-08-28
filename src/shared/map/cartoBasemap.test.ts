import { describe, expect, it } from "vitest";

import { cartoLightAllTilesUrl } from "./cartoBasemap";

describe("cartoLightAllTilesUrl", () => {
  it("appends a key query param when a CARTO API key is set", () => {
    expect(cartoLightAllTilesUrl("cb1_test_key")).toBe(
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=cb1_test_key",
    );
  });

  it("reads VITE_CARTO_API_KEY when no override is passed", () => {
    expect(cartoLightAllTilesUrl()).toBe(
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=test-carto-key",
    );
  });

  it("omits the query param when the key is blank", () => {
    expect(cartoLightAllTilesUrl("")).toBe(
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    );
    expect(cartoLightAllTilesUrl("   ")).toBe(
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    );
  });
});
