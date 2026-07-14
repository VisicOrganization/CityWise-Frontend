import { useEffect, useState } from "react";

import { fetchCouncilMembers } from "../../shared/api/client";
import {
  biosMapByNameFromDistrictProfiles,
  biosMapFromDistrictProfiles,
  type CouncilMemberBio,
} from "../../shared/data/councilMemberBio";

interface CouncilMemberBioIndex {
  byDistrict: Map<number, CouncilMemberBio>;
  byName: Map<string, CouncilMemberBio>;
}

let biosIndexPromise: Promise<CouncilMemberBioIndex> | null = null;

export function resetCouncilMemberBiosCacheForTests(): void {
  biosIndexPromise = null;
}

function fetchCouncilMemberBiosIndex(): Promise<CouncilMemberBioIndex> {
  return fetchCouncilMembers().then(({ items }) => ({
    byDistrict: biosMapFromDistrictProfiles(items),
    byName: biosMapByNameFromDistrictProfiles(items),
  }));
}

export function loadCouncilMemberBiosIndexOnce(): Promise<CouncilMemberBioIndex> {
  if (!biosIndexPromise) {
    biosIndexPromise = fetchCouncilMemberBiosIndex();
  }
  return biosIndexPromise;
}

interface UseCouncilMemberBiosResult {
  biosByDistrict: Map<number, CouncilMemberBio> | null;
  /** Keyed by `councilMemberNameKey`; used when a mover carries no usable district. */
  biosByName: Map<string, CouncilMemberBio> | null;
  error: string | null;
  isLoading: boolean;
}

export function useCouncilMemberBios(): UseCouncilMemberBiosResult {
  const [index, setIndex] = useState<CouncilMemberBioIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    void loadCouncilMemberBiosIndexOnce()
      .then((loaded) => {
        if (!ignore) {
          setIndex(loaded);
        }
      })
      .catch(() => {
        if (!ignore) {
          setIndex(null);
          setError("Could not load council members.");
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

  return {
    biosByDistrict: index?.byDistrict ?? null,
    biosByName: index?.byName ?? null,
    error,
    isLoading,
  };
}
