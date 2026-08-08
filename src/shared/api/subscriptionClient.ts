import type {
  AssignPlanRequest,
  DashboardResponse,
  ManualScrapeResponse,
  NewFilesQuery,
  NewFilesResponse,
  SubscriptionAuthConfig,
  SubscriptionMe,
  SubscriptionPlan,
} from "./subscriptionContracts";

function getApiBaseUrl(): string {
  const isVitest = typeof process !== "undefined" && Boolean(process.env.VITEST);
  const fromProcess =
    typeof process !== "undefined" ? (process.env.VITE_API_BASE_URL as string | undefined) : undefined;
  const fromImportMeta = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const raw = (isVitest ? fromProcess : fromProcess ?? fromImportMeta) ?? "";
  const trimmed = raw.trim();
  return trimmed || "http://localhost:18100";
}

export class SubscriptionApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `Subscription request failed (${status})`);
    this.name = "SubscriptionApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(response: Response): Promise<SubscriptionApiError> {
  let detail: unknown = null;
  try {
    detail = await response.json();
  } catch {
    detail = await response.text().catch(() => null);
  }
  const message =
    typeof detail === "object" &&
    detail &&
    "detail" in detail &&
    typeof (detail as { detail: unknown }).detail === "string"
      ? (detail as { detail: string }).detail
      : undefined;
  return new SubscriptionApiError(response.status, detail, message);
}

async function subscriptionFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function getSubscriptionAuthConfig(): Promise<SubscriptionAuthConfig> {
  const url = new URL("/subscriptions/auth/config", getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as SubscriptionAuthConfig;
}

export async function getSubscriptionMe(accessToken: string): Promise<SubscriptionMe> {
  return subscriptionFetch<SubscriptionMe>("/subscriptions/me", accessToken);
}

export async function putSubscriptionDistricts(
  accessToken: string,
  districtIds: number[],
): Promise<SubscriptionMe> {
  return subscriptionFetch<SubscriptionMe>("/subscriptions/me/districts", accessToken, {
    method: "PUT",
    body: JSON.stringify({ district_ids: districtIds }),
  });
}

export async function getSubscriptionDashboard(
  accessToken: string,
  districtId?: number,
): Promise<DashboardResponse> {
  const url = new URL("/subscriptions/me/dashboard", getApiBaseUrl());
  if (districtId != null) {
    url.searchParams.set("district_id", String(districtId));
  }
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as DashboardResponse;
}

export async function getSubscriptionNewFiles(
  accessToken: string,
  query: NewFilesQuery = {},
): Promise<NewFilesResponse> {
  const url = new URL("/subscriptions/me/new-files", getApiBaseUrl());
  if (query.from) {
    url.searchParams.set("from", query.from);
  }
  if (query.to) {
    url.searchParams.set("to", query.to);
  }
  if (query.page != null) {
    url.searchParams.set("page", String(query.page));
  }
  if (query.pageSize != null) {
    url.searchParams.set("page_size", String(query.pageSize));
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as NewFilesResponse;
}

export async function postManualScrape(
  accessToken: string,
  cfId: string,
): Promise<ManualScrapeResponse> {
  return subscriptionFetch<ManualScrapeResponse>(
    `/subscriptions/me/new-files/${encodeURIComponent(cfId)}/scrape`,
    accessToken,
    { method: "POST" },
  );
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const url = new URL("/subscriptions/plans", getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as SubscriptionPlan[];
}

export async function postAssignPlan(
  accessToken: string,
  body: AssignPlanRequest,
): Promise<SubscriptionMe> {
  return subscriptionFetch<SubscriptionMe>("/subscriptions/me/plan", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
