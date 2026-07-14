import type { DistrictProjectCard } from "../../shared/api/contracts";
import { toMarkerCategory, type MapMarker } from "../../shared/map/mapTypes";

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
    category: toMarkerCategory(card.category),
    label: card.title,
    summary: card.summary ?? "",
      longitude: geocode.longitude,
      latitude: geocode.latitude,
    }];
  });
}
