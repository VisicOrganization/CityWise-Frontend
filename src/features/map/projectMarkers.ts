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

export function buildProjectMarkers(cards: DistrictProjectCard[]): MapMarker[] {
  return cards.flatMap((card) => {
    const geocode = card.address_info?.geocode;
    if (!geocode) {
      return [];
    }

    return [{
    id: `project-${card.id}`,
    projectId: card.id,
    districtId: card.district_id,
    kind: "project" as const,
    category: categoryFromProject(card),
    label: card.title,
    summary: card.summary ?? "",
      longitude: geocode.longitude,
      latitude: geocode.latitude,
    }];
  });
}
