import { describe, expect, it } from "vitest";

import { buildProjectMarkers } from "./projectMarkers";


const baseCard = {
  url: null as string | null,
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
  category: "Housing" as string | null,
};

const geocodedAddressInfo = {
  project_title: "Council File",
  primary_address: "123 Main Street",
  addresses: ["123 Main Street"],
  places: [],
  topics: [],
  segments: [],
  geocode: { longitude: -118.4, latitude: 34.05, provider: "test" },
};

describe("buildProjectMarkers", () => {
  it("creates one marker per project using backend geocode coordinates", () => {
    const markers = buildProjectMarkers([
      {
        ...baseCard,
        id: "25-0358",
        title: "Council File 25-0358",
        address_info: {
          project_title: "Council File 25-0358",
          primary_address: "123 Main Street",
          addresses: ["123 Main Street"],
          places: [],
          topics: [],
          segments: [],
          geocode: {
            longitude: -118.4,
            latitude: 34.05,
            provider: "test",
          },
        },
      },
      {
        ...baseCard,
        id: "25-0400",
        title: "Council File 25-0400",
        address_info: {
          project_title: "Council File 25-0400",
          primary_address: "123 Main Street",
          addresses: ["123 Main Street"],
          places: [],
          topics: [],
          segments: [],
          geocode: {
            longitude: -118.41,
            latitude: 34.06,
          },
        },
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

  it("uses the backend project category for the marker", () => {
    const markers = buildProjectMarkers([
      {
        ...baseCard,
        id: "25-0600",
        title: "Council File 25-0600",
        category: "Equity & Community Works",
        address_info: geocodedAddressInfo,
      },
    ]);

    expect(markers[0].category).toBe("Equity & Community Works");
  });

  it("falls back to Miscellaneous for null or unrecognized categories", () => {
    const markers = buildProjectMarkers([
      {
        ...baseCard,
        id: "25-0601",
        title: "Council File 25-0601",
        category: null,
        address_info: geocodedAddressInfo,
      },
      {
        ...baseCard,
        id: "25-0602",
        title: "Council File 25-0602",
        category: "Transportation",
        address_info: geocodedAddressInfo,
      },
    ]);

    expect(markers[0].category).toBe("Miscellaneous");
    expect(markers[1].category).toBe("Miscellaneous");
  });

  it("skips projects without backend geocode coordinates", () => {
    const markers = buildProjectMarkers([
      {
        ...baseCard,
        id: "25-0501",
        title: "Council File 25-0501",
        address_info: {
          project_title: "Council File 25-0501",
          primary_address: "123 Main Street",
          addresses: ["123 Main Street"],
          places: [],
          topics: [],
          segments: [],
          geocode: null,
        },
      },
    ]);

    expect(markers).toHaveLength(0);
  });
});
