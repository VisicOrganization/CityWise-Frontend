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
