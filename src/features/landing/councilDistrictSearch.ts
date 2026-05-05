import type { DistrictProfile } from "../../shared/api/contracts";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";

export type CouncilDistrictRow = {
  districtId: number;
  nameLine: string;
  districtLine: string;
  /** Passed to the map as `focusLabel` (top pill on district sheet). */
  focusLabel: string;
};

function councilMemberLabelFromProfile(member: DistrictProfile): string {
  const fromName = member.name.trim();
  if (fromName) {
    return formatPersonNameForDisplay(fromName);
  }
  const fromParts = [member.first_name?.trim(), member.last_name?.trim()].filter(Boolean).join(" ");
  if (fromParts) {
    return formatPersonNameForDisplay(fromParts);
  }
  return "Council member";
}

/**
 * Landing council directory from `GET /council-members`. When several rows share a `district_id`,
 * the first in API order is used so the picker stays one row per district.
 */
export function sortedCouncilRowsFromProfiles(members: DistrictProfile[]): CouncilDistrictRow[] {
  const byDistrict = new Map<number, DistrictProfile>();
  for (const member of members) {
    if (!byDistrict.has(member.district_id)) {
      byDistrict.set(member.district_id, member);
    }
  }
  const sortedIds = [...byDistrict.keys()].sort((a, b) => a - b);
  return sortedIds.map((districtId) => {
    const member = byDistrict.get(districtId);
    if (!member) {
      throw new Error(`Missing council member for district ${districtId}`);
    }
    const nameLine = councilMemberLabelFromProfile(member);
    const districtLine = `Council District ${districtId}`;
    return {
      districtId,
      nameLine,
      districtLine,
      focusLabel: `${nameLine} — ${districtLine}`,
    };
  });
}
