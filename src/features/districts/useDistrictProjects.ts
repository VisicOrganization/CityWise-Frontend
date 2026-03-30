import { useEffect, useState } from "react";

import { getDistrictProjects } from "../../shared/api/client";
import type { DistrictProjectsResponse } from "../../shared/api/contracts";


interface UseDistrictProjectsState {
  response: DistrictProjectsResponse | null;
  error: string | null;
  isLoading: boolean;
}


export function useDistrictProjects(districtId: number, page: number, pageSize: number): UseDistrictProjectsState {
  const [response, setResponse] = useState<DistrictProjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    getDistrictProjects(districtId, page, pageSize)
      .then((nextResponse) => {
        if (!ignore) {
          setResponse(nextResponse);
        }
      })
      .catch((nextError: Error) => {
        if (!ignore) {
          setError(nextError.message);
          setResponse(null);
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
  }, [districtId, page, pageSize]);

  return { response, error, isLoading };
}
