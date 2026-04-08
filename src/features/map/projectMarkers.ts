import type { DistrictProjectCard } from "../../shared/api/contracts";
import type { MapMarker, MarkerCategory } from "../../shared/map/mapTypes";

function categoryFromProject(card: DistrictProjectCard): MarkerCategory {
  const topics = (card.address_info?.topics ?? []).join(" ").toLowerCase();
  if (topics.includes("transit") || topics.includes("transport")) {
    return "transit";
  }
  if (topics.includes("park") || topics.includes("infra") || topics.includes("infrastructure")) {
    return "parks";
  }
  return "housing";
}

export interface ProjectMarkerInput {
  card: DistrictProjectCard;
  longitude: number;
  latitude: number;
}

export function buildProjectMarkers(resolved: ProjectMarkerInput[]): MapMarker[] {
  return resolved.map(({ card, longitude, latitude }) => ({
    id: `project-${card.id}`,
    projectId: card.id,
    districtId: card.district_id,
    kind: "project" as const,
    category: categoryFromProject(card),
    label: card.title,
    longitude,
    latitude,
  }));
}
