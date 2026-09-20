import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHiddenForDistrict, COUNCIL_DISTRICTS } from "./councilDistricts";
import { parseCsaIndexPayload } from "./csaIndex";

// Read via node:fs rather than a JSON import: the file lives under `public/`, outside the
// `src` project the app's tsconfig covers, so importing it would reach past `tsc --build`'s
// project boundary instead of exercising the real shipped file.
const SHIPPED_INDEX_PATH = join(__dirname, "../../../public/data/lahsa-2020-csa-index.json");
const shippedRows = parseCsaIndexPayload(
  JSON.parse(readFileSync(SHIPPED_INDEX_PATH, "utf-8")),
);
const shippedLabels = new Set(shippedRows.map((row) => row.CSA_Label));

describe("COUNCIL_DISTRICTS", () => {
  it("every hardcoded csaLabel matches a real row in the shipped index", () => {
    // A typo here would silently select 6 neighborhoods instead of 7 with no error — this
    // assertion is the only thing standing between that and a demo that quietly ships wrong.
    for (const district of COUNCIL_DISTRICTS) {
      for (const label of district.csaLabels) {
        expect(shippedLabels.has(label)).toBe(true);
      }
    }
  });
});

describe("buildHiddenForDistrict", () => {
  it("leaves exactly the district's CSAs visible and hides every other row", () => {
    const district = COUNCIL_DISTRICTS.find((entry) => entry.id === "cd2")!;
    const hidden = buildHiddenForDistrict(shippedRows, district);

    expect(shippedRows).toHaveLength(304);
    expect(hidden.size).toBe(297);
    for (const label of district.csaLabels) {
      expect(hidden.has(label)).toBe(false);
    }
  });
});
