import { describe, expect, it } from "vitest";

import type { AffiliationsMatrix } from "../../shared/api/contracts";
import {
  HEAT_BUCKETS,
  bucketForPercent,
  buildMatrixIndex,
  categoriesPresent,
  filterBodies,
  hasMatrixData,
} from "./councilmemberMatrixData";

const matrix: AffiliationsMatrix = {
  members: [
    { member_id: 12, name: "Traci Park", district_id: 11, total_files: 200 },
    { member_id: 5, name: "Nithya Raman", district_id: 4, total_files: 100 },
  ],
  bodies: [
    { category: "Department", full_name: "Bureau of Sanitation" },
    { category: "Department", full_name: "Bureau of Engineering" },
    { category: "Committee", full_name: "Housing Committee" },
  ],
  cells: [
    { member_id: 12, full_name: "Bureau of Sanitation", file_count: 38, percent_of_total: 19 },
    { member_id: 12, full_name: "Housing Committee", file_count: 20, percent_of_total: 10 },
    { member_id: 5, full_name: "Bureau of Engineering", file_count: 5, percent_of_total: 5 },
  ],
};

describe("councilmemberMatrix", () => {
  it("orders present categories canonically", () => {
    expect(categoriesPresent(matrix.bodies)).toEqual(["Committee", "Department"]);
  });

  it("filters bodies to a single category and keeps API order", () => {
    const departments = filterBodies(matrix.bodies, "Department");
    expect(departments.map((body) => body.full_name)).toEqual([
      "Bureau of Sanitation",
      "Bureau of Engineering",
    ]);
    expect(filterBodies(matrix.bodies, "")).toHaveLength(3);
  });

  it("builds a dense lookup where missing (member, body) pairs resolve to null", () => {
    const index = buildMatrixIndex(matrix.cells);
    // Present pair.
    expect(index.get(12, "Bureau of Sanitation")?.percent_of_total).toBe(19);
    // Sparse pair not in `cells` — the caller renders it as an empty 0% cell.
    expect(index.get(5, "Bureau of Sanitation")).toBeNull();
    expect(index.get(12, "Bureau of Engineering")).toBeNull();
  });

  it("restricts the color-normalizing max to the visible bodies", () => {
    const allBodies = buildMatrixIndex(matrix.cells);
    expect(allBodies.maxPercent).toBe(19);

    const departmentsOnly = buildMatrixIndex(matrix.cells, filterBodies(matrix.bodies, "Committee"));
    // Only the Housing Committee cell (10%) is visible, so it becomes the ramp maximum.
    expect(departmentsOnly.maxPercent).toBe(10);
    expect(departmentsOnly.get(12, "Bureau of Sanitation")).toBeNull();
  });

  it("buckets percents against the visible max, keeping empty cells empty", () => {
    expect(bucketForPercent(0, 19)).toBe(0);
    expect(bucketForPercent(-1, 19)).toBe(0);
    // The busiest visible cell saturates the top bucket.
    expect(bucketForPercent(19, 19)).toBe(HEAT_BUCKETS);
    // Any positive value lands in at least bucket 1.
    expect(bucketForPercent(0.01, 19)).toBe(1);
    // Falls back to bucket 1 when there is no positive max to normalize against.
    expect(bucketForPercent(5, 0)).toBe(1);
  });

  it("reports whether there is a grid to render", () => {
    expect(hasMatrixData(matrix)).toBe(true);
    expect(hasMatrixData({ members: [], bodies: matrix.bodies, cells: [] })).toBe(false);
    expect(hasMatrixData(null)).toBe(false);
  });
});
