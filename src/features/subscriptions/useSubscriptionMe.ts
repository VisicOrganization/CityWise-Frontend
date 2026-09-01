import { useCallback, useEffect, useState } from "react";

import { getSubscriptionMe } from "../../shared/api/subscriptionClient";
import type { SubscriptionMe } from "../../shared/api/subscriptionContracts";
import { useAppAuth } from "../../shared/auth/AuthProvider";

export function useSubscriptionMe() {
  const { getAccessToken, isAuthenticated, isLoading: authLoading } = useAppAuth();
  const [me, setMe] = useState<SubscriptionMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const next = await getSubscriptionMe(token);
      setMe(next);
      return next;
    } catch (err) {
      setMe(null);
      setError(err instanceof Error ? err.message : "Could not load subscription.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      setMe(null);
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  return { me, setMe, error, isLoading: authLoading || isLoading, refresh };
}
