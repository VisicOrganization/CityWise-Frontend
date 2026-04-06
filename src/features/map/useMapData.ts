import { useEffect, useState } from "react";

import { getDistrictProjects, getDistricts } from "../../shared/api/client";
import type { DistrictProjectCard } from "../../shared/api/contracts";
import { loadDistrictBoundaries, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import {
  geocodeStreetAddress,
  NOMINATIM_REQUEST_INTERVAL_MS,
  sleep,
} from "../../shared/map/geocodeAddress";
import type { MapMarker } from "../../shared/map/mapTypes";
import { getPrimaryStreetForGeocoding } from "../../shared/map/projectAddress";
import { buildProjectMarkers, type ProjectMarkerInput } from "./projectMarkers";

const PROJECT_PAGE_SIZE = 100;

let cachedBoundariesPromise: Promise<DistrictBoundaryCollection> | null = null;
let cachedProjectCardsPromise: Promise<DistrictProjectCard[]> | null = null;

async function loadDistrictProjectCards(districtId: number): Promise<DistrictProjectCard[]> {
  const firstPage = await getDistrictProjects(districtId, 1, PROJECT_PAGE_SIZE);
  if (firstPage.total_pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.total_pages - 1 }, (_, index) =>
      getDistrictProjects(districtId, index + 2, PROJECT_PAGE_SIZE),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
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
    let cancelled = false;

    async function resolveMarkers() {
      if (projectCards.length === 0) {
        setProjectMarkers([]);
        return;
      }

      const streetToCards = new Map<string, DistrictProjectCard[]>();
      for (const card of projectCards) {
        const street = getPrimaryStreetForGeocoding(card);
        if (!street) {
          continue;
        }
        const list = streetToCards.get(street) ?? [];
        list.push(card);
        streetToCards.set(street, list);
      }

      const uniqueStreets = [...streetToCards.keys()];
      const resolved: ProjectMarkerInput[] = [];

      for (let i = 0; i < uniqueStreets.length; i++) {
        if (cancelled) {
          return;
        }
        if (i > 0) {
          await sleep(NOMINATIM_REQUEST_INTERVAL_MS);
        }
        const street = uniqueStreets[i];
        const coords = await geocodeStreetAddress(street);
        if (cancelled || !coords) {
          continue;
        }
        for (const card of streetToCards.get(street) ?? []) {
          resolved.push({
            card,
            longitude: coords.longitude,
            latitude: coords.latitude,
          });
        }
      }

      if (!cancelled) {
        setProjectMarkers(buildProjectMarkers(resolved));
      }
    }

    void resolveMarkers();

    return () => {
      cancelled = true;
    };
  }, [projectCards]);

  return { boundaries, projectCards, projectMarkers };
}
