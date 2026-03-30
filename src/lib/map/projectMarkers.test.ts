import { describe, expect, it } from "vitest";

import { buildProjectMarkers } from "./projectMarkers";


const boundaries = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        District: 11,
        District_Name: "Council District 11",
        NAME: "District 11",
        NLA_URL: "",
        OBJECTID: 11,
        TOOLTIP: "District 11",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-118.6, 34.0],
          [-118.4, 34.0],
          [-118.4, 34.2],
          [-118.6, 34.2],
          [-118.6, 34.0],
        ]],
      },
    },
  ],
} as const;

describe("buildProjectMarkers", () => {
  it("creates one marker per project with an assigned project id", () => {
    const markers = buildProjectMarkers(boundaries, [
      {
        id: "25-0358",
        title: "Council File 25-0358",
        summary: "Summary",
        status: "planned",
        district_id: 11,
        last_changed_date: "2025-04-11",
        start_date: "2025-04-04",
        meeting_date: "2025-04-11",
        primary_movers: [],
        secondary_movers: [],
        document_count: 1,
      },
      {
        id: "25-0400",
        title: "Council File 25-0400",
        summary: "Summary",
        status: "planned",
        district_id: 11,
        last_changed_date: "2025-04-12",
        start_date: "2025-04-08",
        meeting_date: "2025-04-12",
        primary_movers: [],
        secondary_movers: [],
        document_count: 1,
      },
    ]);

    expect(markers).toHaveLength(2);
    expect(markers[0].projectId).toBe("25-0358");
    expect(markers[0].districtId).toBe(11);
    expect(markers[0].kind).toBe("project");
    expect(markers[1].longitude).not.toBe(markers[0].longitude);
    expect(markers[1].latitude).not.toBe(markers[0].latitude);
  });
});
