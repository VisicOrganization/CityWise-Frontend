import { describe, expect, it } from "vitest";

import { buildProjectMarkers } from "./projectMarkers";


const baseCard = {
  summary: "Summary",
  status: "planned" as const,
  district_id: 11,
  last_changed_date: "2025-04-11",
  start_date: "2025-04-04",
  meeting_date: "2025-04-11",
  primary_movers: [] as string[],
  secondary_movers: [] as string[],
  document_count: 1,
  primary_address: "123 Main Street" as string | null,
};

describe("buildProjectMarkers", () => {
  it("creates one marker per resolved project with coordinates from geocoding", () => {
    const markers = buildProjectMarkers([
      {
        card: {
          ...baseCard,
          id: "25-0358",
          title: "Council File 25-0358",
        },
        longitude: -118.4,
        latitude: 34.05,
      },
      {
        card: {
          ...baseCard,
          id: "25-0400",
          title: "Council File 25-0400",
        },
        longitude: -118.41,
        latitude: 34.06,
      },
    ]);

    expect(markers).toHaveLength(2);
    expect(markers[0].projectId).toBe("25-0358");
    expect(markers[0].districtId).toBe(11);
    expect(markers[0].kind).toBe("project");
    expect(markers[0].longitude).toBe(-118.4);
    expect(markers[0].latitude).toBe(34.05);
    expect(markers[1].longitude).toBe(-118.41);
    expect(markers[1].latitude).toBe(34.06);
  });
});
