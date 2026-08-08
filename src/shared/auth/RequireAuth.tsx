import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

import { useAppAuth } from "./AuthProvider";

export function RequireAuth({ children }: PropsWithChildren) {
  const { isLoading, isAuthenticated, login, mode, authConfig } = useAppAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="subscriptions-page">
        <p className="subscriptions-status">Checking sign-in…</p>
      </div>
    );
  }

  if (mode === "unavailable") {
    return (
      <div className="subscriptions-page">
        <section className="subscriptions-card subscriptions-card--narrow">
          <h1>Sign-in unavailable</h1>
          <p>
            Auth0 SPA config could not be loaded from{" "}
            <code>GET /subscriptions/auth/config</code>
            {authConfig && !authConfig.configured ? " (configured: false)" : ""}.
          </p>
          <p className="subscriptions-muted">
            Ensure the backend has <code>SUBSCRIPTIONS_ENABLED=1</code> and Auth0 env vars set, or for
            local dogfood set <code>VITE_SUBSCRIPTIONS_ALLOW_DEV_AUTH=1</code>.
          </p>
        </section>
      </div>
    );
  }

  if (mode === "dev") {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="subscriptions-page">
        <section className="subscriptions-card subscriptions-card--narrow">
          <h1>Sign in to continue</h1>
          <p>
            Email alerts send you here. Sign in with Auth0 to manage districts and see what&apos;s new
            for your council subscriptions.
          </p>
          <button
            type="button"
            className="subscriptions-primary-btn"
            onClick={() => {
              login();
            }}
          >
            Sign in with Auth0
          </button>
          <p className="subscriptions-muted">
            After login you&apos;ll return to{" "}
            <code>
              {location.pathname.startsWith("/new-files") ||
              location.pathname.startsWith("/subscriptions")
                ? location.pathname
                : "/new-files"}
            </code>
            .
          </p>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}
