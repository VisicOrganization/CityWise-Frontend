import type { ProjectDetail } from "../../../shared/api/contracts";

export type NormalizedProjectStatus = "completed" | "in_progress" | "planned" | "default";

export function normalizeProjectStatus(raw: string | null | undefined): NormalizedProjectStatus {
  const s = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (s === "completed" || s === "complete") {
    return "completed";
  }
  if (s.includes("progress") || s === "in_progress") {
    return "in_progress";
  }
  if (s === "planned" || s === "planning") {
    return "planned";
  }
  return "default";
}

export function statusLabelForDisplay(raw: string | null | undefined): string {
  const n = normalizeProjectStatus(raw);
  if (n === "completed") {
    return "Completed";
  }
  if (n === "in_progress") {
    return "In Progress";
  }
  if (n === "planned") {
    return "Planned";
  }
  return raw?.trim() ? raw.replace(/[\s_-]+/g, " ") : "Status";
}

interface StatusBadgeProps {
  status: string;
  project?: ProjectDetail["project"] | null;
}

export function StatusBadge({ status, project }: StatusBadgeProps) {
  const normalized = normalizeProjectStatus(status);
  const label = statusLabelForDisplay(status);

  return (
    <span
      className={`project-status-badge project-status-badge--${normalized}`}
      role="status"
      aria-label={`Project status: ${label}`}
      title={project?.vote_action ?? undefined}
    >
      {label}
    </span>
  );
}
