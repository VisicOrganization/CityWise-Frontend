import type {
  DistrictListResponse,
  DistrictProfile,
  DistrictProjectsResponse,
  ProjectDetail,
} from "./contracts";

function getApiBaseUrl(): string {
  const isVitest = typeof process !== "undefined" && Boolean(process.env.VITEST);
  const fromProcess =
    typeof process !== "undefined" ? (process.env.VITE_API_BASE_URL as string | undefined) : undefined;
  const fromImportMeta = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const raw = (isVitest ? fromProcess : fromProcess ?? fromImportMeta) ?? "";
  const trimmed = raw.trim();
  return trimmed || "http://localhost:18100";
}

const API_CACHE_PREFIX = "citywise:api-cache:v1:";

type StorageValue<T> = {
  data: T;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function readFromCache<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(`${API_CACHE_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StorageValue<T>;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeToCache<T>(key: string, data: T): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const value: StorageValue<T> = { data };
    storage.setItem(`${API_CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    /* Ignore quota and serialization errors so API calls still succeed. */
  }
}

export function clearApiCacheForTests(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(API_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}


export async function getDistricts(): Promise<DistrictListResponse> {
  const cacheKey = "districts";
  const cached = readFromCache<DistrictListResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL("/districts", getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load districts");
  }

  const data = (await response.json()) as DistrictListResponse;
  writeToCache(cacheKey, data);
  return data;
}

export async function getDistrictProfile(districtId: number): Promise<DistrictProfile> {
  const cacheKey = `district-profile:${districtId}`;
  const cached = readFromCache<DistrictProfile>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(`/districts/${districtId}`, getApiBaseUrl());
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load district ${districtId} profile`);
  }

  const data = (await response.json()) as DistrictProfile;
  writeToCache(cacheKey, data);
  return data;
}

export async function getDistrictProjects(
  districtId: number,
  page: number,
  pageSize: number,
): Promise<DistrictProjectsResponse> {
  const cacheKey = `district-projects:${districtId}:${page}:${pageSize}:has_geocode=true`;
  const cached = readFromCache<DistrictProjectsResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(`/districts/${districtId}/projects`, getApiBaseUrl());
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("has_geocode", "true");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load district ${districtId} projects`);
  }

  const data = (await response.json()) as DistrictProjectsResponse;
  writeToCache(cacheKey, data);
  return data;
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail> {
  const cacheKey = `project-detail:${projectId}`;
  const cached = readFromCache<ProjectDetail>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(`/projects/${projectId}`, getApiBaseUrl());
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load project ${projectId}`);
  }

  const data = (await response.json()) as ProjectDetail;
  writeToCache(cacheKey, data);
  return data;
}
