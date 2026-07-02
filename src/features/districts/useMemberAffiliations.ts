import { useEffect, useState } from "react";

import { getMemberAffiliations } from "../../shared/api/client";
import type { MemberAffiliations } from "../../shared/api/contracts";

interface UseMemberAffiliationsResult {
  affiliations: MemberAffiliations | null;
  error: string | null;
  isLoading: boolean;
}

export function useMemberAffiliations(memberId: number | null): UseMemberAffiliationsResult {
  const [affiliations, setAffiliations] = useState<MemberAffiliations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (memberId == null) {
      setAffiliations(null);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    let ignore = false;
    setIsLoading(true);
    setError(null);

    void getMemberAffiliations(memberId)
      .then((loaded) => {
        if (!ignore) {
          setAffiliations(loaded);
        }
      })
      .catch(() => {
        if (!ignore) {
          setAffiliations(null);
          setError("Could not load council member committees and departments.");
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
  }, [memberId]);

  return { affiliations, error, isLoading };
}
