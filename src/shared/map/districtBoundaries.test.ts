import { describe, expect, it } from "vitest";

import { findDistrictIdForPoint, type DistrictBoundaryCollection } from "./districtBoundaries";

const boundariesFixture: DistrictBoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        District: 1,
        District_Name: "District 1",
        NAME: "District 1",
        NLA_URL: "",
        OBJECTID: 1,
        TOOLTIP: "District 1",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-118.5, 34.0],
          [-118.3, 34.0],
          [-118.3, 34.2],
          [-118.5, 34.2],
          [-118.5, 34.0],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        District: 2,
        District_Name: "District 2",
        NAME: "District 2",
        NLA_URL: "",
        OBJECTID: 2,
        TOOLTIP: "District 2",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[
            [-118.2, 34.0],
            [-118.0, 34.0],
            [-118.0, 34.2],
            [-118.2, 34.2],
            [-118.2, 34.0],
          ]],
          [[
            [-118.2, 34.25],
            [-118.0, 34.25],
            [-118.0, 34.35],
            [-118.2, 34.35],
            [-118.2, 34.25],
          ]],
        ],
      },
    },
  ],
};

describe("findDistrictIdForPoint", () => {
  it("returns district for a point inside polygon", () => {
    expect(findDistrictIdForPoint(boundariesFixture, -118.4, 34.1)).toBe(1);
  });

  it("returns district for a point inside multipolygon", () => {
    expect(findDistrictIdForPoint(boundariesFixture, -118.1, 34.3)).toBe(2);
  });

  it("returns district when point lies on boundary edge", () => {
    expect(findDistrictIdForPoint(boundariesFixture, -118.3, 34.1)).toBe(1);
  });

  it("returns null when point is outside all districts", () => {
    expect(findDistrictIdForPoint(boundariesFixture, -118.8, 34.5)).toBeNull();
  });
});
