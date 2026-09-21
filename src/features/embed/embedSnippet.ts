import {
  neighborhoodSlug,
  shortNeighborhoodName,
  type NeighborhoodCollection,
} from "../map/cd2Assets";

/** Where the snippet is meant to be pasted, and what it renders. */
export interface EmbedTarget {
  /** `null` for the district-wide embed. */
  slug: string | null;
  /** "Valley Glen", or "District-wide" for the district embed. */
  name: string;
  /** The `/embed/v1/...` path this target renders. */
  path: string;
  /** The `title` attribute, which is the map's accessible name on the council's page. */
  title: string;
  /** The council-office page this belongs on, straight from the shipped data. */
  destinationUrl: string | null;
}

export const EMBED_HEIGHT = 560;

export function districtSlugFor(districtId: number): string {
  return `cd${districtId}`;
}

/**
 * Only `src`, `width`, `height` and `title` -- the four attributes observed surviving the
 * council office's CKEditor text filter on their live district page. Anything else (`style`,
 * `class`, `loading`, `allowfullscreen`) is stripped on save, so emitting it would only teach
 * whoever pastes this that the snippet is unreliable.
 */
export function buildEmbedSnippet(origin: string, target: EmbedTarget): string {
  return `<iframe src="${origin}${target.path}" width="100%" height="${EMBED_HEIGHT}" title="${target.title}"></iframe>`;
}

/**
 * Every target for a district: the district-wide embed first, then one per neighbourhood.
 *
 * Derived from the shipped `cd2-neighborhoods.geojson` -- both the slugs (via
 * `neighborhoodSlug`) and the destination pages (via each feature's `source_url`, with the
 * collection's `district_source_url` for the district row). A hardcoded table here would be the
 * same jurisdiction data in a second place, free to drift from the dataset the map renders.
 */
export function buildEmbedTargets(
  districtId: number,
  neighborhoods: NeighborhoodCollection,
): EmbedTarget[] {
  const districtSlug = districtSlugFor(districtId);

  const districtTarget: EmbedTarget = {
    slug: null,
    name: "District-wide",
    path: `/embed/v1/${districtSlug}`,
    title: `Map of Council District ${districtId} resources`,
    destinationUrl: neighborhoods.district_source_url ?? null,
  };

  const neighborhoodTargets = neighborhoods.features
    .map((feature) => {
      const csaLabel = feature.properties?.CSA_Label ?? "";
      const name = shortNeighborhoodName(csaLabel);
      const slug = neighborhoodSlug(csaLabel);
      return {
        slug,
        name,
        path: `/embed/v1/${districtSlug}/${slug}`,
        title: `Map of neighborhood resources in ${name}`,
        destinationUrl: feature.properties?.source_url ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return [districtTarget, ...neighborhoodTargets];
}
