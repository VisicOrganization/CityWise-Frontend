import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { csaLabelFromSlug, neighborhoodSlug, type NeighborhoodCollection } from "./cd2Assets";

// Read via node:fs rather than a JSON import: the file lives under `public/`, outside the
// `src` project the app's tsconfig covers, so importing it would reach past `tsc --build`'s
// project boundary instead of exercising the real shipped file.
const SHIPPED_NEIGHBORHOODS_PATH = join(
  __dirname,
  "../../../public/data/cd2-neighborhoods.geojson",
);
const neighborhoods = JSON.parse(
  readFileSync(SHIPPED_NEIGHBORHOODS_PATH, "utf-8"),
) as NeighborhoodCollection;

// The 7 slugs CD2's own website uses, in the order the task lists them.
const REAL_SLUGS: Record<string, string> = {
  "valley-glen": "Los Angeles - Valley Glen",
  "north-hollywood": "Los Angeles - North Hollywood",
  "studio-city": "Los Angeles - Studio City",
  "sun-valley": "Los Angeles - Sun Valley",
  "toluca-lake": "Los Angeles - Toluca Lake",
  "valley-village": "Los Angeles - Valley Village",
  "van-nuys": "Los Angeles - Van Nuys",
};

describe("neighborhoodSlug / csaLabelFromSlug", () => {
  it.each(Object.entries(REAL_SLUGS))("round-trips %s against the real CD2 dataset", (slug, csaLabel) => {
    expect(neighborhoodSlug(csaLabel)).toBe(slug);
    expect(csaLabelFromSlug(slug, neighborhoods)).toBe(csaLabel);
  });

  it("covers every polygon actually in the shipped file, not just the 7 named here", () => {
    const labels = neighborhoods.features.map((feature) => feature.properties.CSA_Label);
    expect(new Set(labels)).toEqual(new Set(Object.values(REAL_SLUGS)));
    for (const label of labels) {
      expect(csaLabelFromSlug(neighborhoodSlug(label), neighborhoods)).toBe(label);
    }
  });

  it("returns null for a slug with no matching polygon", () => {
    expect(csaLabelFromSlug("not-a-real-neighborhood", neighborhoods)).toBeNull();
  });

  it("tolerates case and extra whitespace in the slug", () => {
    expect(csaLabelFromSlug("  Valley-Glen  ", neighborhoods)).toBe("Los Angeles - Valley Glen");
    expect(csaLabelFromSlug("VAN_NUYS", neighborhoods)).toBe("Los Angeles - Van Nuys");
  });
});
