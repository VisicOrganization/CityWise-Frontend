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
    primaryAddress: card.primary_address ?? card.address_info?.primary_address ?? null,
    affiliations: card.affiliations ?? [],
      longitude: geocode.longitude,
      latitude: geocode.latitude,
    }];
  });
}
