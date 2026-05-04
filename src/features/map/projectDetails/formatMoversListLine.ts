import type { ProjectDetail } from "../../../shared/api/contracts";
import { formatName } from "../../../shared/formatPersonName";

/** Single-line movers summary: "Name (Primary), Name (Secondary), …". */
export function formatMoversListLine(detail: ProjectDetail): string | null {
  const parts: string[] = [];
  for (const m of detail.movers.primary) {
    const n = formatName(m.name).trim();
    if (n.length > 0) {
      parts.push(`${n} (Primary)`);
    }
  }
  for (const m of detail.movers.secondary) {
    const n = formatName(m.name).trim();
    if (n.length > 0) {
      parts.push(`${n} (Secondary)`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : null;
}
