import { useEffect, useState } from "react";

import { getDistrictProfile } from "../../shared/api/client";
import type { DistrictProfile } from "../../shared/api/contracts";

interface UseDistrictProfileResult {
  profile: DistrictProfile | null;
  error: string | null;
  isLoading: boolean;
}

export function useDistrictProfile(districtId: number | null): UseDistrictProfileResult {
  const [profile, setProfile] = useState<DistrictProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (districtId == null) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    let ignore = false;
    setIsLoading(true);
    setError(null);

    void getDistrictProfile(districtId)
      .then((loaded) => {
        if (!ignore) {
          setProfile(loaded);
        }
      })
      .catch(() => {
        if (!ignore) {
          setProfile(null);
          setError("Could not load council member profile.");
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
  }, [districtId]);

  return { profile, error, isLoading };
}
