import { useEffect, useState } from "react";

import { getDistrictProjects } from "../../shared/api/client";
import type { DistrictProjectCard } from "../../shared/api/contracts";
import { loadDistrictBoundaries, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import type { DemoMapMarker } from "../../shared/mock/mapDemo";
import { buildProjectMarkers } from "./projectMarkers";


const DISTRICT_IDS = Array.from({ length: 15 }, (_, index) => index + 1);
const DEMO_PROJECT_PAGE_SIZE = 100;


async function loadDistrictProjectCards(districtId: number): Promise<DistrictProjectCard[]> {
  const firstPage = await getDistrictProjects(districtId, 1, DEMO_PROJECT_PAGE_SIZE);
  if (firstPage.total_pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.total_pages - 1 }, (_, index) =>
      getDistrictProjects(districtId, index + 2, DEMO_PROJECT_PAGE_SIZE),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}


async function loadAllProjectCards(): Promise<DistrictProjectCard[]> {
  const districtPages = await Promise.all(
    DISTRICT_IDS.map(async (districtId) => {
      try {
        return await loadDistrictProjectCards(districtId);
      } catch {
        return [];
      }
    }),
  );

  return districtPages.flat();
}


interface UseMapDemoDataState {
  boundaries: DistrictBoundaryCollection | null;
  projectCards: DistrictProjectCard[];
  projectMarkers: DemoMapMarker[];
}


export function useMapDemoData(): UseMapDemoDataState {
  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [projectCards, setProjectCards] = useState<DistrictProjectCard[]>([]);
  const [projectMarkers, setProjectMarkers] = useState<DemoMapMarker[]>([]);

  useEffect(() => {
    let ignore = false;

    Promise.all([loadDistrictBoundaries(), loadAllProjectCards()])
      .then(([loadedBoundaries, loadedProjectCards]) => {
        if (ignore) {
          return;
        }

        setBoundaries(loadedBoundaries);
        setProjectCards(loadedProjectCards);
        setProjectMarkers(buildProjectMarkers(loadedBoundaries, loadedProjectCards));
      })
      .catch(() => {
        if (!ignore) {
          setBoundaries(null);
          setProjectCards([]);
          setProjectMarkers([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return { boundaries, projectCards, projectMarkers };
}
