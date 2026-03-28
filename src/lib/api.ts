import type { DistrictProjectsResponse } from "./contracts";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:18100";


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
