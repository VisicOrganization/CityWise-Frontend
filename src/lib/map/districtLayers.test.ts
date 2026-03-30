import { describe, expect, it } from "vitest";

import {
  districtColorExpression,
  districtFillLayer,
  districtFillOpacityExpression,
} from "./districtLayers";


describe("districtLayers", () => {
  it("assigns hard-coded colors per district", () => {
    expect(districtFillLayer.paint?.["fill-color"]).toEqual(districtColorExpression);
    expect(districtColorExpression[0]).toBe("match");
    expect(districtColorExpression).toContain("#e76f51");
    expect(districtColorExpression).toContain("#8338ec");
  });

  it("fades district fill as the user zooms in", () => {
    expect(districtFillLayer.paint?.["fill-opacity"]).toEqual(districtFillOpacityExpression);
    expect(districtFillOpacityExpression).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      7,
      0.42,
      9.5,
      0.28,
      12,
      0.16,
      14.5,
      0.08,
    ]);
  });
});
