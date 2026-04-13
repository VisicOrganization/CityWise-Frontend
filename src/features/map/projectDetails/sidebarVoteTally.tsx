import type { ProjectDetail } from "../../../shared/api/contracts";

/** Backend may send vote_given as string, number, or other JSON — never assume .trim exists */
function voteGivenToParseString(voteGiven: unknown): string | null {
  if (voteGiven == null) {
    return null;
  }
  if (typeof voteGiven === "string") {
    const t = voteGiven.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof voteGiven === "number" && Number.isFinite(voteGiven)) {
    return String(voteGiven);
  }
  return null;
}

function parseVoteGivenTally(voteGiven: unknown): { yes: number; no: number; absent: number } | null {
  const str = voteGivenToParseString(voteGiven);
  if (!str) {
    return null;
  }
  const inner = str.replace(/^\(|\)$/g, "");
  const parts = inner.split(/\s*-\s*/).map((part) => Number.parseInt(part.trim(), 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return { yes: parts[0] ?? 0, no: parts[1] ?? 0, absent: parts[2] ?? 0 };
  }
  return null;
}

/** Figma / voting modal: Yes #16a34a, No #dc2626, Absent #4b5563, separator #9ca3af */
export function SidebarVoteTallyValue({
  detail,
  voteTally,
}: {
  detail: ProjectDetail;
  voteTally: { yes: number; no: number; absent: number };
}) {
  const hasMemberVotes = (detail.votes ?? []).length > 0;
  const parsed = parseVoteGivenTally(detail.project.vote_given);
  const showColored = hasMemberVotes || parsed != null;

  if (showColored) {
    const y = hasMemberVotes ? voteTally.yes : parsed!.yes;
    const n = hasMemberVotes ? voteTally.no : parsed!.no;
    const a = hasMemberVotes ? voteTally.absent : parsed!.absent;
    return (
      <span className="project-sidebar-tally">
        <span className="project-sidebar-tally-yes">Yes {y}</span>
        <span className="project-sidebar-tally-sep" aria-hidden="true">
          {" "}
          ·{" "}
        </span>
        <span className="project-sidebar-tally-no">No {n}</span>
        <span className="project-sidebar-tally-sep" aria-hidden="true">
          {" "}
          ·{" "}
        </span>
        <span className="project-sidebar-tally-absent">Absent {a}</span>
      </span>
    );
  }

  const raw = voteGivenToParseString(detail.project.vote_given);
  if (raw) {
    return <span className="project-sidebar-tally-fallback">{raw}</span>;
  }
  return null;
}

export function sidebarHasVoteTallyDisplay(detail: ProjectDetail): boolean {
  if ((detail.votes ?? []).length > 0) {
    return true;
  }
  if (parseVoteGivenTally(detail.project.vote_given)) {
    return true;
  }
  return voteGivenToParseString(detail.project.vote_given) != null;
}
