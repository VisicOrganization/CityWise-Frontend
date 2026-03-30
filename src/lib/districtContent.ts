import { demoDistricts } from "./mock/mapDemo";


export interface DistrictImpactItem {
  id: string;
  label: string;
  stat: string;
  description: string;
}

export interface DistrictContent {
  districtId: number;
  title: string;
  representative: string;
  website: string;
  phone: string;
  email: string;
  summary: string;
  about: string;
  impactSummary: DistrictImpactItem[];
}

function buildPhone(districtId: number) {
  const suffix = String(7000 + districtId * 13).padStart(4, "0");
  return `(213) 473-${suffix}`;
}

function buildImpactSummary(districtId: number): DistrictImpactItem[] {
  return [
    {
      id: "housing",
      label: "Housing",
      stat: `${districtId * 180 + 1200} units`,
      description: "Pipeline housing activity tracked through motions, updates, and public works approvals.",
    },
    {
      id: "transportation",
      label: "Transportation",
      stat: `${districtId * 3 + 14} corridor upgrades`,
      description: "Street, curb, and mobility improvements reflected in recent council project activity.",
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      stat: `$${(districtId * 24 + 180).toLocaleString()}M`,
      description: "Capital-facing maintenance and construction work surfaced through the current MVP read path.",
    },
  ];
}

function buildDistrictContent(districtId: number): DistrictContent {
  const district = demoDistricts[districtId];
  const representative = district?.representative ?? `District ${districtId} Representative`;
  const slug = representative.toLowerCase().replaceAll(" ", ".");

  return {
    districtId,
    title: `District ${districtId}`,
    representative,
    website: `https://cd${districtId}.lacity.gov/`,
    phone: buildPhone(districtId),
    email: `councilmember.${slug}@lacity.org`,
    summary: `${representative} overview for CityWise's district-level demo route.`,
    about:
      `${representative} is represented here with stable demo profile copy while the district page continues to pull real project activity from the backend. This page is meant to make the district route feel complete enough for the MVP demo without waiting on a fuller district-profile source.`,
    impactSummary: buildImpactSummary(districtId),
  };
}

const DISTRICT_CONTENT: Record<number, DistrictContent> = Object.fromEntries(
  Array.from({ length: 15 }, (_, index) => {
    const districtId = index + 1;
    return [districtId, buildDistrictContent(districtId)];
  }),
) as Record<number, DistrictContent>;

export function getDistrictContent(districtId: number): DistrictContent {
  return DISTRICT_CONTENT[districtId] ?? buildDistrictContent(districtId);
}

export function getDeterministicProjectBudget(districtId: number, projectId: string): number {
  const hash = Array.from(`${districtId}:${projectId}`).reduce((total, char) => total + char.charCodeAt(0), 0);
  const baseMillions = 180 + districtId * 37 + (hash % 190);
  return baseMillions * 1_000_000;
}
