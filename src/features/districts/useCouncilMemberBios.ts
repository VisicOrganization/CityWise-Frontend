import { useEffect, useState } from "react";

import { fetchCouncilMembers } from "../../shared/api/client";
import { biosMapFromDistrictProfiles, type CouncilMemberBio } from "../../shared/data/councilMemberBio";

let biosMapPromise: Promise<Map<number, CouncilMemberBio>> | null = null;

export function resetCouncilMemberBiosCacheForTests(): void {
  biosMapPromise = null;
}

function fetchCouncilMemberBiosMap(): Promise<Map<number, CouncilMemberBio>> {
  return fetchCouncilMembers().then(({ items }) => biosMapFromDistrictProfiles(items));
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

  return { biosByDistrict, error, isLoading };
}
