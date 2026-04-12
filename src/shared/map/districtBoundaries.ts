import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";


export interface DistrictBoundaryProperties {
  District: number;
  District_Name: string;
  NAME: string;
  NLA_URL: string;
  OBJECTID: number;
  TOOLTIP: string;
}


export type DistrictBoundaryFeature = Feature<Polygon | MultiPolygon, DistrictBoundaryProperties>;
export type DistrictBoundaryCollection = FeatureCollection<Polygon | MultiPolygon, DistrictBoundaryProperties>;

const DISTRICT_BOUNDARIES_PATH = new URL("data/la-city-council-districts.geojson", window.location.origin + import.meta.env.BASE_URL).toString();


export async function loadDistrictBoundaries(): Promise<DistrictBoundaryCollection> {
  const response = await fetch(DISTRICT_BOUNDARIES_PATH);
  if (!response.ok) {
    throw new Error("Failed to load district boundaries");
  }
  return response.json() as Promise<DistrictBoundaryCollection>;
}


export function getSupportedDistrictIds(boundaries: DistrictBoundaryCollection): number[] {
  return boundaries.features.map((feature) => feature.properties.District).sort((left, right) => left - right);
}


export function findDistrictFeature(
  boundaries: DistrictBoundaryCollection,
  districtId: number,
): DistrictBoundaryFeature | undefined {
  return boundaries.features.find((feature) => feature.properties.District === districtId);
}

type LngLat = [number, number];

function isPointOnSegment(point: LngLat, segmentStart: LngLat, segmentEnd: LngLat): boolean {
  const [pointLng, pointLat] = point;
  const [startLng, startLat] = segmentStart;
  const [endLng, endLat] = segmentEnd;
  const crossProduct = (pointLat - startLat) * (endLng - startLng) - (pointLng - startLng) * (endLat - startLat);

  if (Math.abs(crossProduct) > 1e-10) {
    return false;
  }

  const segmentLengthSquared = (endLng - startLng) ** 2 + (endLat - startLat) ** 2;
  if (segmentLengthSquared < 1e-14) {
    return Math.abs(pointLng - startLng) < 1e-10 && Math.abs(pointLat - startLat) < 1e-10;
  }

  const dotProduct = (pointLng - startLng) * (endLng - startLng) + (pointLat - startLat) * (endLat - startLat);
  if (dotProduct < 0) {
    return false;
  }

  return dotProduct <= segmentLengthSquared;
}

function isPointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [pointLng, pointLat] = point;
  let inside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    if (!current || !previous) {
      continue;
    }

    if (isPointOnSegment(point, previous, current)) {
      return true;
    }

    const [currentLng, currentLat] = current;
    const [previousLng, previousLat] = previous;
    const intersects = (currentLat > pointLat) !== (previousLat > pointLat);
    if (!intersects) {
      continue;
    }

    const intersectionLng =
      ((previousLng - currentLng) * (pointLat - currentLat)) / (previousLat - currentLat) + currentLng;
    if (pointLng < intersectionLng) {
      inside = !inside;
    }
  }

  return inside;
}

function doesPolygonContainPoint(polygon: LngLat[][], point: LngLat): boolean {
  const exteriorRing = polygon[0];
  if (!exteriorRing || !isPointInRing(point, exteriorRing)) {
    return false;
  }

  for (let index = 1; index < polygon.length; index += 1) {
    const holeRing = polygon[index];
    if (holeRing && isPointInRing(point, holeRing)) {
      return false;
    }
  }

  return true;
}

export function findDistrictIdForPoint(
  boundaries: DistrictBoundaryCollection,
  longitude: number,
  latitude: number,
): number | null {
  const point: LngLat = [longitude, latitude];

  for (const feature of boundaries.features) {
    const geometry = feature.geometry;
    const districtId = feature.properties.District;
    if (geometry.type === "Polygon") {
      if (doesPolygonContainPoint(geometry.coordinates as LngLat[][], point)) {
        return districtId;
      }
      continue;
    }

    for (const polygon of geometry.coordinates as LngLat[][][]) {
      if (doesPolygonContainPoint(polygon, point)) {
        return districtId;
      }
    }
  }

  return null;
}


function extendBounds(bounds: [[number, number], [number, number]], lng: number, lat: number) {
  bounds[0][0] = Math.min(bounds[0][0], lng);
  bounds[0][1] = Math.min(bounds[0][1], lat);
  bounds[1][0] = Math.max(bounds[1][0], lng);
  bounds[1][1] = Math.max(bounds[1][1], lat);
}


export function getFeatureBounds(feature: DistrictBoundaryFeature): [[number, number], [number, number]] {
  const bounds: [[number, number], [number, number]] = [
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ];

  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        extendBounds(bounds, lng, lat);
      }
    }
  }

  return bounds;
}
