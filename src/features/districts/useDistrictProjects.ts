import { useEffect, useState } from "react";

import { getDistrictProjects } from "../../shared/api/client";
import type { DistrictProjectsResponse } from "../../shared/api/contracts";

/** Backend `GET /districts/{id}/projects` caps `page_size` at 100. */
const DISTRICT_PROJECTS_PAGE_SIZE_MAX = 100;

export interface UseDistrictProjectsOptions {
  /** Request successive pages until every project for the district is loaded. */
  fetchAllPages?: boolean;
}

interface UseDistrictProjectsState {
  response: DistrictProjectsResponse | null;
  error: string | null;
  isLoading: boolean;
}

export function useDistrictProjects(
  districtId: number,
  page: number,
  pageSize: number,
  options?: UseDistrictProjectsOptions,
): UseDistrictProjectsState {
  const [response, setResponse] = useState<DistrictProjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchAllPages = Boolean(options?.fetchAllPages);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (fetchAllPages) {
          const chunk = Math.min(pageSize, DISTRICT_PROJECTS_PAGE_SIZE_MAX);
          let pageNum = page;
          const mergedItems: DistrictProjectsResponse["items"] = [];
          let first: DistrictProjectsResponse | null = null;

          while (!ignore) {
            const batch = await getDistrictProjects(districtId, pageNum, chunk);
            if (!first) {
              first = batch;
            }
            mergedItems.push(...batch.items);
            if (mergedItems.length >= batch.total || batch.items.length === 0) {
              break;
            }
            pageNum += 1;
          }

          if (!ignore && first) {
            setResponse({
              ...first,
              page: 1,
              page_size: mergedItems.length,
              total_pages: mergedItems.length ? 1 : 0,
              items: mergedItems,
              total: first.total,
            });
          }
        } else {
          const nextResponse = await getDistrictProjects(districtId, page, pageSize);
          if (!ignore) {
            setResponse(nextResponse);
          }
        }
      } catch (nextError) {
        if (!ignore) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load district projects");
          setResponse(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [districtId, page, pageSize, fetchAllPages]);

  return { response, error, isLoading };
}
