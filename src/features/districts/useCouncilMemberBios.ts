import { useEffect, useState } from "react";

import {
  type CouncilMemberBio,
  parseCouncilMemberBiosPayload,
} from "../../shared/data/councilMemberBio";

let biosMapPromise: Promise<Map<number, CouncilMemberBio>> | null = null;

export function resetCouncilMemberBiosCacheForTests(): void {
  biosMapPromise = null;
}

function fetchCouncilMemberBiosMap(): Promise<Map<number, CouncilMemberBio>> {
  const url = `${import.meta.env.BASE_URL}data/cmem-bios.json`;

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load council member bios (${response.status})`);
      }
      return response.json() as Promise<unknown>;
    })
    .then((payload) => {
      const rows = parseCouncilMemberBiosPayload(payload);
      const map = new Map<number, CouncilMemberBio>();
      for (const row of rows) {
        map.set(row.cd, row);
      }
      return map;
    });
}

export function loadCouncilMemberBiosMapOnce(): Promise<Map<number, CouncilMemberBio>> {
  if (!biosMapPromise) {
    biosMapPromise = fetchCouncilMemberBiosMap();
  }
  return biosMapPromise;
}

interface UseCouncilMemberBiosResult {
  biosByDistrict: Map<number, CouncilMemberBio> | null;
  error: string | null;
  isLoading: boolean;
}

export function useCouncilMemberBios(): UseCouncilMemberBiosResult {
  const [biosByDistrict, setBiosByDistrict] = useState<Map<number, CouncilMemberBio> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    void loadCouncilMemberBiosMapOnce()
      .then((map) => {
        if (!ignore) {
          setBiosByDistrict(map);
        }
      })
      .catch(() => {
        if (!ignore) {
          setBiosByDistrict(null);
          setError("Could not load council member bios.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return { biosByDistrict, error, isLoading };
}
