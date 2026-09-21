import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { NeighborhoodCollection } from "../map/cd2Assets";
import { buildEmbedSnippet, buildEmbedTargets } from "./embedSnippet";

// The shipped file, not a fixture: these snippets are pasted into a government CMS, so they
// should be generated from exactly the data the map renders.
const SHIPPED = path.join(process.cwd(), "public", "data", "cd2-neighborhoods.geojson");
const neighborhoods = JSON.parse(readFileSync(SHIPPED, "utf8")) as NeighborhoodCollection;

describe("buildEmbedTargets", () => {
  const targets = buildEmbedTargets(2, neighborhoods);

  it("covers the district plus every neighborhood in the shipped data", () => {
    expect(targets).toHaveLength(neighborhoods.features.length + 1);
  });

  it("puts the district-wide target first, pointing at the district page", () => {
    expect(targets[0].slug).toBeNull();
    expect(targets[0].path).toBe("/embed/v1/cd2");
    expect(targets[0].destinationUrl).toBe("https://cd2.lacity.gov/district-2");
  });

  /**
   * The real check: our slug is derived from the CSA label, while the destination page is a URL
   * transcribed from the council's own site. Nothing forces those to agree -- if they ever
   * diverge, the builder would hand someone a Valley Glen snippet to paste on the Van Nuys page.
   */
  it("derives slugs that match the last segment of each council-office page URL", () => {
    for (const target of targets.slice(1)) {
      expect(target.destinationUrl).not.toBeNull();
      const lastSegment = new URL(target.destinationUrl!).pathname.split("/").filter(Boolean).pop();
      expect(lastSegment).toBe(target.slug);
    }
  });

  it("gives every neighborhood target a district-scoped path and a descriptive title", () => {
    for (const target of targets.slice(1)) {
      expect(target.path).toBe(`/embed/v1/cd2/${target.slug}`);
      expect(target.title).toBe(`Map of neighborhood resources in ${target.name}`);
    }
  });
});

describe("buildEmbedSnippet", () => {
  const [districtTarget, firstNeighborhood] = buildEmbedTargets(2, neighborhoods);

  it("emits only the four attributes the council's CMS preserves", () => {
    const snippet = buildEmbedSnippet("https://citywise.app", firstNeighborhood);
    const attributes = [...snippet.matchAll(/\s([a-z-]+)=/g)].map((match) => match[1]);
    expect(attributes).toEqual(["src", "width", "height", "title"]);
    expect(snippet).not.toMatch(/style=|class=|loading=|allowfullscreen/);
  });

  it("points at the production origin, never a relative or preview URL", () => {
    const snippet = buildEmbedSnippet("https://citywise.app", districtTarget);
    expect(snippet).toContain('src="https://citywise.app/embed/v1/cd2"');
    expect(snippet).toContain('width="100%"');
    expect(snippet).toContain('height="560"');
  });
});
