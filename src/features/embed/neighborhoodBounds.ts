import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

import type { NeighborhoodProperties } from "../map/cd2Assets";

/**
 * Bounds for one neighbourhood, so the embed can fit to it the way `getFeatureBounds` in
 * `shared/map/districtBoundaries.ts` fits a whole district.
 *
 * Handles MultiPolygon as well as Polygon, because the shipped data contains both: clipping the
 * CSA polygons to the district in `build_cd2_assets.py` splits North Hollywood into two pieces.
 * `NeighborhoodCollection` declares `Polygon`, which is simply wrong about the file -- an
 * earlier version of this function trusted that type, destructured `[lng, lat]` out of what was
 * actually a ring of rings, and produced NaN bounds that left the map blank.
 */
function ringsOf(geometry: Polygon | MultiPolygon): Position[][] {
  return geometry.type === "MultiPolygon"
    ? geometry.coordinates.flat()
    : geometry.coordinates;
}

export function polygonBounds(
  feature: Feature<Polygon | MultiPolygon, NeighborhoodProperties>,
): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const ring of ringsOf(feature.geometry)) {
    for (const position of ring) {
      const [lng, lat] = position;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue;
      }
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    }
  }

  // `null` rather than a degenerate box: the caller falls back to the district framing, which is
  // wrong-but-usable. Handing MapLibre a non-finite bound renders nothing at all.
  if (![west, south, east, north].every(Number.isFinite) || west > east || south > north) {
    return null;
  }

  return [
    [west, south],
    [east, north],
  ];
}
