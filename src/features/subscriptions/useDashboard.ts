import { useCallback, useEffect, useState } from "react";

import { getSubscriptionDashboard, SubscriptionApiError } from "../../shared/api/subscriptionClient";
import type { DashboardResponse } from "../../shared/api/subscriptionContracts";
import { useAppAuth } from "../../shared/auth/AuthProvider";

export function useDashboard(districtId: number | null) {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAppAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const next = await getSubscriptionDashboard(token, districtId ?? undefined);
      setData(next);
    } catch (err) {
      setError(
        err instanceof SubscriptionApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [districtId, getAccessToken, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  return { data, error, isLoading, refresh, setData };
}
