import { useCallback, useEffect, useState } from "react";

import { getSubscriptionNewFiles } from "../../shared/api/subscriptionClient";
import type { NewFilesQuery, NewFilesResponse } from "../../shared/api/subscriptionContracts";
import { useAppAuth } from "../../shared/auth/AuthProvider";

export function useNewFiles(query: NewFilesQuery) {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAppAuth();
  const [data, setData] = useState<NewFilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const next = await getSubscriptionNewFiles(token, query);
      setData(next);
      return next;
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load new files.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, query.from, query.to, query.page, query.pageSize]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      setData(null);
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  return { data, error, isLoading: authLoading || isLoading, refresh };
}
