import type { DistrictProjectCard } from "../../shared/api/contracts";
import {
  findDistrictFeature,
  getFeatureBounds,
  type DistrictBoundaryCollection,
} from "../../shared/map/districtBoundaries";
import type { DemoMapMarker } from "../../shared/mock/mapDemo";


function categoryFromProject(project: DistrictProjectCard): DemoMapMarker["category"] {
  const categories: DemoMapMarker["category"][] = ["housing", "transit", "parks"];
  const score = Array.from(project.id).reduce((total, char) => total + char.charCodeAt(0), 0);
  return categories[score % categories.length];
}

function getDistrictCenter(boundaries: DistrictBoundaryCollection, districtId: number) {
  const feature = findDistrictFeature(boundaries, districtId);
  if (!feature) {
    return null;
  }

  const [[minLng, minLat], [maxLng, maxLat]] = getFeatureBounds(feature);
  return {
    longitude: (minLng + maxLng) / 2,
    latitude: (minLat + maxLat) / 2,
  };
}

function getMarkerNudge(index: number) {
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = 0.008 + Math.floor(index / 6) * 0.004;

  return {
    longitude: Math.cos(angle) * radius,
    latitude: Math.sin(angle) * radius * 0.72,
  };
}

export function buildProjectMarkers(
  boundaries: DistrictBoundaryCollection,
  projects: DistrictProjectCard[],
): DemoMapMarker[] {
  const projectCountsByDistrict = new Map<number, number>();

  return projects.flatMap((project) => {
    const districtId = project.district_id;
    const center = getDistrictCenter(boundaries, districtId);
    if (!center) {
      return [];
    }

    const index = projectCountsByDistrict.get(districtId) ?? 0;
    projectCountsByDistrict.set(districtId, index + 1);

    const nudge = getMarkerNudge(index);

    return [
      {
        id: `project-${project.id}`,
        projectId: project.id,
        districtId,
        kind: "project",
        category: categoryFromProject(project),
        label: project.title,
        longitude: center.longitude + nudge.longitude,
        latitude: center.latitude + nudge.latitude,
      },
    ];
  });
}
