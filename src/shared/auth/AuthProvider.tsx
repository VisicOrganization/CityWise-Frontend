import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useNavigate } from "react-router-dom";

import { getSubscriptionAuthConfig } from "../api/subscriptionClient";
import type { SubscriptionAuthConfig } from "../api/subscriptionContracts";

const DEV_TOKEN_STORAGE_KEY = "citywise:subscriptions-dev-token";
const DEFAULT_POST_LOGIN_PATH = "/new-files";

/** Prefer the current subscriptions route; otherwise send users to the dashboard. */
export function resolvePostLoginReturnTo(pathnameWithSearch: string): string {
  const path = pathnameWithSearch.split("?")[0] || "/";
  if (path.startsWith("/new-files") || path.startsWith("/subscriptions")) {
    return pathnameWithSearch || DEFAULT_POST_LOGIN_PATH;
  }
  return DEFAULT_POST_LOGIN_PATH;
}

function readEnv(name: string): string {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const fromProcess =
    typeof process !== "undefined" ? (process.env[name] as string | undefined) : undefined;
  return (fromImportMeta ?? fromProcess ?? "").trim();
}

/** Explicit local override only — not the default Auth0 path. */
export function isDevAuthExplicitlyEnabled(): boolean {
  const flag = readEnv("VITE_SUBSCRIPTIONS_ALLOW_DEV_AUTH").toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") {
    return true;
  }
  return Boolean(readEnv("VITE_SUBSCRIPTIONS_DEV_TOKEN"));
}

export function getDefaultDevToken(): string {
  return readEnv("VITE_SUBSCRIPTIONS_DEV_TOKEN") || "dev:alice";
}

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  email: string | null;
  mode: "auth0" | "dev" | "unavailable";
  authConfig: SubscriptionAuthConfig | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function DevAuthProvider({ children }: PropsWithChildren) {
  const token = useMemo(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
      if (stored?.trim()) {
        return stored.trim();
      }
    }
    return getDefaultDevToken();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      email: `${token.replace(/^dev:/, "")}@dev.citywise.local`,
      mode: "dev",
      authConfig: null,
      login: () => undefined,
      logout: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
        }
      },
      getAccessToken: async () => token,
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthUnavailableProvider({
  children,
  authConfig,
  errorMessage,
}: PropsWithChildren<{ authConfig: SubscriptionAuthConfig | null; errorMessage: string }>) {
  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: false,
      isAuthenticated: false,
      email: null,
      mode: "unavailable",
      authConfig,
      login: () => undefined,
      logout: () => undefined,
      getAccessToken: async () => {
        throw new Error(errorMessage);
      },
    }),
    [authConfig, errorMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0AuthBridge({
  children,
  audience,
  authConfig,
}: PropsWithChildren<{ audience: string | null; authConfig: SubscriptionAuthConfig }>) {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const getAccessToken = useCallback(async () => {
    return getAccessTokenSilently({
      authorizationParams: {
        audience: audience || undefined,
      },
    });
  }, [audience, getAccessTokenSilently]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated,
      email: user?.email ?? null,
      mode: "auth0",
      authConfig,
      login: () => {
        const returnTo = resolvePostLoginReturnTo(
          window.location.pathname + window.location.search,
        );
        void loginWithRedirect({
          appState: { returnTo },
        });
      },
      logout: () => {
        auth0Logout({
          logoutParams: { returnTo: window.location.origin },
        });
      },
      getAccessToken,
    }),
    [
      auth0Logout,
      authConfig,
      getAccessToken,
      isAuthenticated,
      isLoading,
      loginWithRedirect,
      user?.email,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthBootLoading({ children }: PropsWithChildren) {
  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: true,
      isAuthenticated: false,
      email: null,
      mode: "unavailable",
      authConfig: null,
      login: () => undefined,
      logout: () => undefined,
      getAccessToken: async () => {
        throw new Error("Auth is still loading.");
      },
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Loads Auth0 SPA settings from GET /subscriptions/auth/config (primary).
 * Dev Bearer (`dev:alice`) only when VITE_SUBSCRIPTIONS_ALLOW_DEV_AUTH or
 * VITE_SUBSCRIPTIONS_DEV_TOKEN is set explicitly — never the silent default.
 * Does not use POST /subscriptions/auth/google.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [bootState, setBootState] = useState<
    | { status: "loading" }
    | { status: "auth0"; config: SubscriptionAuthConfig }
    | { status: "dev" }
    | { status: "unavailable"; config: SubscriptionAuthConfig | null; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const config = await getSubscriptionAuthConfig();
        if (cancelled) {
          return;
        }

        const domain = config.domain?.trim() ?? "";
        const clientId = config.client_id?.trim() ?? "";
        if (config.configured && domain && clientId) {
          setBootState({ status: "auth0", config });
          return;
        }

        if (isDevAuthExplicitlyEnabled()) {
          setBootState({ status: "dev" });
          return;
        }

        setBootState({
          status: "unavailable",
          config,
          message:
            "Auth0 is not configured on the API. Set AUTH0_DOMAIN, AUTH0_AUDIENCE, and AUTH0_CLIENT_ID, or enable local dev auth with VITE_SUBSCRIPTIONS_ALLOW_DEV_AUTH=1.",
        });
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (isDevAuthExplicitlyEnabled()) {
          setBootState({ status: "dev" });
          return;
        }
        setBootState({
          status: "unavailable",
          config: null,
          message:
            err instanceof Error
              ? `Could not load auth config: ${err.message}`
              : "Could not load auth config from /subscriptions/auth/config.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (bootState.status === "loading") {
    return <AuthBootLoading>{children}</AuthBootLoading>;
  }

  if (bootState.status === "dev") {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }

  if (bootState.status === "unavailable") {
    return (
      <AuthUnavailableProvider authConfig={bootState.config} errorMessage={bootState.message}>
        {children}
      </AuthUnavailableProvider>
    );
  }

  const { config } = bootState;
  const domain = config.domain!.trim();
  const clientId = config.client_id!.trim();
  const audience = config.audience?.trim() || null;

  return (
    <Auth0ProviderWithNavigate domain={domain} clientId={clientId} audience={audience} config={config}>
      {children}
    </Auth0ProviderWithNavigate>
  );
}

function Auth0ProviderWithNavigate({
  children,
  domain,
  clientId,
  audience,
  config,
}: PropsWithChildren<{
  domain: string;
  clientId: string;
  audience: string | null;
  config: SubscriptionAuthConfig;
}>) {
  const navigate = useNavigate();

  const onRedirectCallback = useCallback(
    (appState?: AppState) => {
      const target =
        typeof appState?.returnTo === "string" && appState.returnTo.startsWith("/")
          ? appState.returnTo
          : DEFAULT_POST_LOGIN_PATH;
      navigate(target, { replace: true });
    },
    [navigate],
  );

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
        audience: audience || undefined,
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0AuthBridge audience={audience} authConfig={config}>
        {children}
      </Auth0AuthBridge>
    </Auth0Provider>
  );
}

export function useAppAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAppAuth must be used within AuthProvider");
  }
  return ctx;
}
