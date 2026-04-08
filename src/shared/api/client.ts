import type {
  DistrictListResponse,
  DistrictProfile,
  DistrictProjectsResponse,
  ProjectDetail,
} from "./contracts";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:18100";


export async function getDistricts(): Promise<DistrictListResponse> {
  const url = new URL("/districts", API_BASE_URL);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load districts");
  }

  return response.json() as Promise<DistrictListResponse>;
}

export async function getDistrictProfile(districtId: number): Promise<DistrictProfile> {
  const url = new URL(`/districts/${districtId}`, API_BASE_URL);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load district ${districtId} profile`);
  }

  return response.json() as Promise<DistrictProfile>;
}

export async function getDistrictProjects(
  districtId: number,
  page: number,
  pageSize: number,
): Promise<DistrictProjectsResponse> {
  const url = new URL(`/districts/${districtId}/projects`, API_BASE_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load district ${districtId} projects`);
  }

  return response.json() as Promise<DistrictProjectsResponse>;
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail> {
  const url = new URL(`/projects/${projectId}`, API_BASE_URL);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load project ${projectId}`);
  }

  return response.json() as Promise<ProjectDetail>;
}
