import { useEffect, useState } from "react";

import { getDistrictProjects, getDistricts } from "../../shared/api/client";
import type { DistrictProjectCard } from "../../shared/api/contracts";
import { loadDistrictBoundaries, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import type { MapMarker } from "../../shared/map/mapTypes";
import { buildProjectMarkers } from "./projectMarkers";

/** Map demo loads a small sample per district to limit API and geocoding work. */
const MAP_PROJECTS_PER_DISTRICT = 100;

let cachedBoundariesPromise: Promise<DistrictBoundaryCollection> | null = null;
let cachedProjectCardsPromise: Promise<DistrictProjectCard[]> | null = null;

async function loadDistrictProjectCards(districtId: number): Promise<DistrictProjectCard[]> {
  const firstPage = await getDistrictProjects(districtId, 1, MAP_PROJECTS_PER_DISTRICT);
  return firstPage.items.slice(0, MAP_PROJECTS_PER_DISTRICT);
}

async function loadAllProjectCards(): Promise<DistrictProjectCard[]> {
  const { district_ids: districtIds } = await getDistricts();
  if (districtIds.length === 0) {
    return [];
  }

  const districtPages = await Promise.all(
    districtIds.map(async (districtId) => {
      try {
        return await loadDistrictProjectCards(districtId);
      } catch {
        return [];
      }
    }),
  );

  return districtPages.flat();
}

function loadCachedDistrictBoundaries() {
  if (!cachedBoundariesPromise) {
    cachedBoundariesPromise = loadDistrictBoundaries().catch((error) => {
      cachedBoundariesPromise = null;
      throw error;
    });
  }

  return cachedBoundariesPromise;
}

function loadCachedProjectCards() {
  if (!cachedProjectCardsPromise) {
    cachedProjectCardsPromise = loadAllProjectCards().catch((error) => {
      cachedProjectCardsPromise = null;
      throw error;
    });
  }

  return cachedProjectCardsPromise;
}

export function resetMapDataCacheForTests() {
  cachedBoundariesPromise = null;
  cachedProjectCardsPromise = null;
}

interface UseMapDataState {
  boundaries: DistrictBoundaryCollection | null;
  projectCards: DistrictProjectCard[];
  projectMarkers: MapMarker[];
}

export function useMapData(): UseMapDataState {
  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [projectCards, setProjectCards] = useState<DistrictProjectCard[]>([]);
  const [projectMarkers, setProjectMarkers] = useState<MapMarker[]>([]);

  useEffect(() => {
    let ignore = false;

    void loadCachedDistrictBoundaries()
      .then((loadedBoundaries) => {
        if (ignore) {
          return;
        }

        setBoundaries(loadedBoundaries);
      })
      .catch(() => {
        if (!ignore) {
          setBoundaries(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    void loadCachedProjectCards()
      .then((loadedProjectCards) => {
        if (ignore) {
          return;
        }

        setProjectCards(loadedProjectCards);
      })
      .catch(() => {
        if (!ignore) {
          setProjectCards([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setProjectMarkers(buildProjectMarkers(projectCards));
  }, [projectCards]);

  return { boundaries, projectCards, projectMarkers };
}
