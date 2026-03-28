export interface DistrictContent {
  districtId: number;
  title: string;
  representative: string;
  summary: string;
  about: string;
}


const DISTRICT_CONTENT: Record<number, DistrictContent> = {
  11: {
    districtId: 11,
    title: "District 11",
    representative: "Traci Park",
    summary: "Westside projects currently visible in the MVP read path.",
    about:
      "This MVP page combines curated district context with source-backed project records. Only projects with a valid district match are shown.",
  },
};


export function getDistrictContent(districtId: number): DistrictContent {
  return (
    DISTRICT_CONTENT[districtId] ?? {
      districtId,
      title: `District ${districtId}`,
      representative: "City Council district",
      summary: "Curated district copy has not been added for this district yet.",
      about:
        "The map and project cards are still driven by real backend data, but the editorial district summary for this district is still pending.",
    }
  );
}
