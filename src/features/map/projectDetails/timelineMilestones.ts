import type { ProjectDetail, ProjectTimelineEntry } from "../../../shared/api/contracts";

import { formatProjectDateLong } from "./formatProjectDate";

export interface TimelineMilestoneModel {
  id: string;
  label: string;
  date: string | null;
  positionPct: number;
  state: "completed" | "current" | "upcoming";
  documentUrl: string | null;
}

function positionsForCount(count: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [50];
  }
  if (count === 2) {
    return [0, 100];
  }
  if (count === 3) {
    return [0, 50, 100];
  }
  return [0, 25, 75, 100];
}

/** Untruncated entry text; callers that need to fit a fixed slot use labelFromEntry. */
export function fullLabelFromEntry(entry: ProjectTimelineEntry): string {
  const text = entry.text?.trim();
  if (text) {
    return text;
  }
  return (entry.type ?? "Milestone").replace(/_/g, " ");
}

export function labelFromEntry(entry: ProjectTimelineEntry): string {
  const label = fullLabelFromEntry(entry);
  return label.length > 48 ? `${label.slice(0, 45)}…` : label;
}

export function firstHttpDocumentUrl(entry: ProjectTimelineEntry): string | null {
  const doc = entry.documents?.find((d) => d.url?.startsWith("http"));
  return doc?.url ?? null;
}

export function buildTimelineMilestones(entries: ProjectTimelineEntry[]): TimelineMilestoneModel[] {
  const dated = entries.filter((e) => e.date && !Number.isNaN(Date.parse(`${e.date}T12:00:00`)));
  const sorted = [...dated].sort(
    (a, b) => new Date(`${a.date}T12:00:00`).getTime() - new Date(`${b.date}T12:00:00`).getTime(),
  );
  const slots = sorted.slice(0, 4);
  if (slots.length === 0) {
    return [];
  }

  const positions = positionsForCount(slots.length);
  const now = Date.now();
  let currentIdx = slots.findIndex((s) => new Date(`${s.date}T12:00:00`).getTime() > now);
  if (currentIdx === -1) {
    currentIdx = slots.length - 1;
  }

  return slots.map((entry, index) => ({
    id: `tl-${index}-${entry.date}`,
    label: labelFromEntry(entry),
    date: entry.date,
    positionPct: positions[index] ?? (index / Math.max(slots.length - 1, 1)) * 100,
    state: index < currentIdx ? "completed" : index === currentIdx ? "current" : "upcoming",
    documentUrl: firstHttpDocumentUrl(entry),
  }));
}

export function buildFallbackMilestones(meta: {
  start_date: string | null;
  meeting_date: string | null;
  last_changed_date: string | null;
  status: string;
}): TimelineMilestoneModel[] {
  const rows: { label: string; date: string | null }[] = [
    { label: "Submitted", date: meta.start_date },
    { label: "Committee / hearing", date: meta.meeting_date },
    { label: "Last council action", date: meta.last_changed_date },
    { label: "Current status", date: null },
  ];

  const dated = rows.filter((r) => r.date);
  if (dated.length === 0) {
    return [];
  }

  const positions = positionsForCount(dated.length);
  const now = Date.now();
  let currentIdx = dated.findIndex((r) => new Date(`${r.date}T12:00:00`).getTime() > now);
  if (currentIdx === -1) {
    currentIdx = dated.length - 1;
  }

  return dated.map((row, index) => ({
    id: `fb-${index}`,
    label: row.label,
    date: row.date,
    positionPct: positions[index] ?? 0,
    state: index < currentIdx ? "completed" : index === currentIdx ? "current" : "upcoming",
    documentUrl: null,
  }));
}

/** Maps milestone state to horizontal timeline node appearance (filled vs hollow). */
export function milestoneToNodeStatus(state: TimelineMilestoneModel["state"]): "completed" | "upcoming" {
  return state === "upcoming" ? "upcoming" : "completed";
}

/** One source file attached to a timeline entry, as the vertical view needs it. */
export interface VerticalTimelineDocument {
  /** null when the entry has no usable http(s) link, so no "View Source" is offered. */
  url: string | null;
  title: string | null;
  /** From the API's `activity_file_summary`; null when the backend has none. */
  activityFileSummary: string | null;
}

export interface VerticalTimelineItem {
  id: string;
  /** Formatted for display */
  date: string;
  description: string;
  /** Empty for entries with no attached files (~12.5% of live entries). */
  documents: VerticalTimelineDocument[];
}

/** Full timeline for the vertical view: API entries when present, else milestone fallback. */
export function buildVerticalTimelineItems(detail: ProjectDetail): VerticalTimelineItem[] {
  const dated = detail.timeline
    .filter((e) => e.date && !Number.isNaN(Date.parse(`${e.date}T12:00:00`)))
    .sort(
      (a, b) =>
        new Date(`${a.date}T12:00:00`).getTime() - new Date(`${b.date}T12:00:00`).getTime(),
    );

  if (dated.length > 0) {
    return dated.map((entry, index) => ({
      id: `vt-${index}-${entry.date}`,
      date: formatProjectDateLong(entry.date),
      description: fullLabelFromEntry(entry),
      // Same http(s) guard the old single-link path applied via firstHttpDocumentUrl:
      // relative/ftp/malformed values become null rather than a broken link.
      documents: (entry.documents ?? []).map((doc) => ({
        url: doc.url?.startsWith("http") ? doc.url : null,
        title: doc.title ?? null,
        activityFileSummary: doc.activity_file_summary?.trim() || null,
      })),
    }));
  }

  const fallback = buildFallbackMilestones({
    start_date: detail.project.start_date,
    meeting_date: detail.project.meeting_date,
    last_changed_date: detail.project.last_changed_date,
    status: detail.project.status,
  });

  // Fallback milestones are synthesised from project metadata, so they have no files.
  return fallback.map((m) => ({
    id: m.id,
    date: formatProjectDateLong(m.date),
    description: m.label,
    documents: [],
  }));
}
