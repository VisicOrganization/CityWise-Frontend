import { useEffect, useState } from "react";

import { getAffiliationsMatrix } from "../../shared/api/client";
import type { AffiliationsMatrix } from "../../shared/api/contracts";

interface UseAffiliationsMatrixResult {
  matrix: AffiliationsMatrix | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Loads the all-councilmembers affiliations matrix. Only fetches while `enabled` (i.e. the overlay
 * is open) so the map screen doesn't pay for it up front; the client caches the response so
 * reopening is instant. Mirrors `useMemberAffiliations` (ignore-flag cleanup, loading/error state).
 */
export function useAffiliationsMatrix(enabled: boolean): UseAffiliationsMatrixResult {
  const [matrix, setMatrix] = useState<AffiliationsMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let ignore = false;
    setIsLoading(true);
    setError(null);

    void getAffiliationsMatrix()
      .then((loaded) => {
        if (!ignore) {
          setMatrix(loaded);
        }
      })
      .catch(() => {
        if (!ignore) {
          setMatrix(null);
          setError("Could not load the councilmember metadata matrix.");
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
  }, [enabled]);

  return { matrix, error, isLoading };
}
