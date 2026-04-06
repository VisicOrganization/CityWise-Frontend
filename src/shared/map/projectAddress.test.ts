import { describe, expect, it } from "vitest";

import type { DistrictProjectCard } from "../api/contracts";
import { getPrimaryStreetForGeocoding } from "./projectAddress";


const base: Omit<DistrictProjectCard, "primary_address" | "address_info"> = {
  id: "25-1465",
  title: "Test",
  summary: "",
  status: "planned",
  district_id: 1,
  last_changed_date: null,
  start_date: null,
  meeting_date: null,
  primary_movers: [],
  secondary_movers: [],
  document_count: 0,
};

describe("getPrimaryStreetForGeocoding", () => {
  it("prefers address_info.primary_address over flat primary_address", () => {
    expect(
      getPrimaryStreetForGeocoding({
        ...base,
        primary_address: "Flat St",
        address_info: {
          project_title: "t",
          primary_address: "5601 North Figueroa Street",
          addresses: ["5601 North Figueroa Street"],
          places: [],
          topics: [],
          segments: [],
        },
      }),
    ).toBe("5601 North Figueroa Street");
  });

  it("uses flat primary_address when address_info is absent", () => {
    expect(
      getPrimaryStreetForGeocoding({
        ...base,
        primary_address: "123 Main Street",
      }),
    ).toBe("123 Main Street");
  });

  it("uses flat primary_address when address_info has null primary_address", () => {
    expect(
      getPrimaryStreetForGeocoding({
        ...base,
        primary_address: "123 Main Street",
        address_info: {
          project_title: "t",
          primary_address: null,
          addresses: [],
          places: [],
          topics: [],
          segments: [],
        },
      }),
    ).toBe("123 Main Street");
  });

  it("returns null when both are empty", () => {
    expect(
      getPrimaryStreetForGeocoding({
        ...base,
        primary_address: null,
        address_info: {
          project_title: "t",
          primary_address: null,
          addresses: [],
          places: [],
          topics: [],
          segments: [],
        },
      }),
    ).toBeNull();
  });
});
