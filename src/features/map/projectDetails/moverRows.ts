import type { ProjectDetail, ProjectMember } from "../../../shared/api/contracts";
import { formatName } from "../../../shared/formatPersonName";

export interface MoverRow {
  key: string;
  name: string;
  districtId: number | null;
  role: "Primary Mover" | "Mover";
}

function rowsFromMembers(members: ProjectMember[], role: MoverRow["role"]): MoverRow[] {
  const rows: MoverRow[] = [];
  for (const member of members) {
    const name = formatName(member.name).trim();
    if (name.length === 0) {
      continue;
    }
    rows.push({ key: `${role}-${member.id}`, name, districtId: member.district_id, role });
  }
  return rows;
}

/** Movers table rows: primary movers first, then secondary movers. */
export function buildMoverRows(detail: ProjectDetail): MoverRow[] {
  return [
    ...rowsFromMembers(detail.movers.primary, "Primary Mover"),
    ...rowsFromMembers(detail.movers.secondary, "Mover"),
  ];
}
