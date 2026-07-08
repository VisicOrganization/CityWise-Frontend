import { CouncilMemberAvatar } from "./CouncilMemberAvatar";
import type { MoverRow } from "./moverRows";

/** Inset table of movers: councilmember avatar, name, and mover role. */
export function MoversTable({ rows }: { rows: MoverRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="project-movers-table" role="table" aria-label="Project movers">
      {rows.map((row) => (
        <div className="project-movers-table-row" role="row" key={row.key}>
          <span className="project-movers-table-cell project-movers-table-cell--avatar" role="cell">
            <CouncilMemberAvatar name={row.name} districtId={row.districtId} />
          </span>
          <span className="project-movers-table-cell project-movers-table-cell--name" role="cell">
            {row.name}
          </span>
          <span className="project-movers-table-cell project-movers-table-cell--role" role="cell">
            {row.role}
          </span>
        </div>
      ))}
    </div>
  );
}
