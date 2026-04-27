import type { CouncilMemberBio } from "../../shared/data/councilMemberBio";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";

export type CouncilDistrictRow = {
  districtId: number;
  nameLine: string;
  districtLine: string;
  /** Passed to the map as `focusLabel` (top pill on district sheet). */
  focusLabel: string;
};

function makeRow(districtId: number, bio: CouncilMemberBio): CouncilDistrictRow {
  const nameLine = formatPersonNameForDisplay(bio.name);
  const districtLine = `Council District ${districtId}`;
  return {
    districtId,
    nameLine,
    districtLine,
    focusLabel: `${nameLine} — ${districtLine}`,
  };
}

/**
 * All council members from `cmem-bios.json` for the landing district dropdown, sorted by district (1–15).
 */
export function sortedCouncilRowsFromBios(
  biosByDistrict: Map<number, CouncilMemberBio>,
): CouncilDistrictRow[] {
  const sortedIds = [...biosByDistrict.keys()].sort((a, b) => a - b);
  const rows: CouncilDistrictRow[] = [];
  for (const id of sortedIds) {
    const bio = biosByDistrict.get(id);
    if (bio) {
      rows.push(makeRow(id, bio));
    }
  }
  return rows;
}
