import { useEffect, useState } from "react";

import type { DistrictBoundaryFeature } from "../../shared/map/districtBoundaries";

/**
 * The CD2 outline for the embed, loaded from the small `public/data/cd2-boundary.geojson` a
 * concurrent agent produces -- NOT `la-city-council-districts.geojson` (1.5 MB, every district,
 * imported by `CityMap.tsx`). The embed must stay lean, and it only ever needs one district's
 * edge.
 *
 * Fetched defensively like `embedProjects.ts`: a missing or malformed file simply means the
 * overlay draws no district edge, never a broken embed.
 */

const BOUNDARY_PATH = "data/cd2-boundary.geojson";

function boundaryUrl(): string {
  return new URL(BOUNDARY_PATH, window.location.origin + import.meta.env.BASE_URL).toString();
}

interface RawFeatureCollection {
  type?: unknown;
  features?: unknown;
}

function isDistrictBoundaryFeature(value: unknown): value is DistrictBoundaryFeature {
  if (!value || typeof value !== "object") {
    return false;
  }
  const feature = value as Record<string, unknown>;
  const properties = feature.properties as Record<string, unknown> | undefined;
  const geometry = feature.geometry as Record<string, unknown> | undefined;
  return (
    feature.type === "Feature" &&
    typeof properties?.District === "number" &&
    (geometry?.type === "Polygon" || geometry?.type === "MultiPolygon")
  );
}

let cached: Promise<DistrictBoundaryFeature[]> | null = null;

export function resetEmbedBoundaryCacheForTests(): void {
  cached = null;
}

function loadEmbedBoundaryFeaturesOnce(): Promise<DistrictBoundaryFeature[]> {
  if (cached) {
    return cached;
  }
  cached = fetch(boundaryUrl())
    .then((response) => {
      if (!response.ok) {
        return [];
      }
      return response
        .json()
        .then((body: RawFeatureCollection) => {
          if (!body || body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
            return [];
          }
          return body.features.filter(isDistrictBoundaryFeature);
        })
        .catch(() => []);
    })
    .catch(() => []);
  return cached;
}

/** `null` if the file is absent/malformed, or has no feature for this district. */
export async function loadEmbedBoundary(districtId: number): Promise<DistrictBoundaryFeature | null> {
  const features = await loadEmbedBoundaryFeaturesOnce();
  return features.find((feature) => feature.properties.District === districtId) ?? null;
}

/**
 * `null` while loading, whenever the outline file is unavailable, or while `enabled` is false --
 * the overlay then simply omits the district edge. `enabled` lets `EmbedPage` skip the fetch
 * entirely on an unknown-district render, the same shape as `useDistrictAssets(id, enabled)`.
 */
export function useEmbedBoundary(districtId: number, enabled = true): DistrictBoundaryFeature | null {
  const [boundary, setBoundary] = useState<DistrictBoundaryFeature | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBoundary(null);
      return;
    }
    let ignore = false;
    setBoundary(null);
    loadEmbedBoundary(districtId).then((result) => {
      if (!ignore) {
        setBoundary(result);
      }
    });
    return () => {
      ignore = true;
    };
  }, [districtId, enabled]);

  return boundary;
}
