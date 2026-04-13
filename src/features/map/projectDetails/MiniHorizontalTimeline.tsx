import { formatProjectDateShort } from "./formatProjectDate";
import type { TimelineMilestoneModel } from "./timelineMilestones";
import { milestoneToNodeStatus } from "./timelineMilestones";

export interface TimelineNodeProps {
  label: string;
  date: string;
  status: "completed" | "upcoming";
}

export function HorizontalTimelineNode({ label, date, status }: TimelineNodeProps) {
  return (
    <div className="project-h-timeline-node-cell">
      <div
        className={`project-h-timeline-node project-h-timeline-node--${status}`}
        aria-hidden="true"
        title={`${label} — ${date}`}
      />
    </div>
  );
}

export interface TimelineNodeItem extends TimelineNodeProps {
  id: string;
  documentUrl: string | null;
}

interface HorizontalTimelineTrackProps {
  nodes: TimelineNodeItem[];
}

/** Segmented horizontal bar with labels; used for the compact sidebar preview. */
export function HorizontalTimelineTrack({ nodes }: HorizontalTimelineTrackProps) {
  if (nodes.length === 0) {
    return null;
  }

  const gridCols = `repeat(${nodes.length}, minmax(0, 1fr))`;

  return (
    <div className="project-h-timeline-container">
      <div className="project-h-timeline-labels-top" style={{ gridTemplateColumns: gridCols }}>
        {nodes.map((n) => (
          <div key={n.id} className="project-h-timeline-label-top">
            {n.documentUrl ? (
              <a
                href={n.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="project-h-timeline-label-link"
              >
                {n.label}
              </a>
            ) : (
              n.label
            )}
          </div>
        ))}
      </div>

      <div className="project-h-timeline-bar project-h-timeline-bar--continuous">
        <div className="project-h-timeline-line-full" aria-hidden="true" />
        <div className="project-h-timeline-nodes" style={{ gridTemplateColumns: gridCols }}>
          {nodes.map((n) => (
            <HorizontalTimelineNode key={n.id} label={n.label} date={n.date} status={n.status} />
          ))}
        </div>
      </div>

      <div className="project-h-timeline-labels-bottom" style={{ gridTemplateColumns: gridCols }}>
        {nodes.map((n) => (
          <div key={n.id} className="project-h-timeline-label-bottom">
            {n.date}
          </div>
        ))}
      </div>
    </div>
  );
}

interface MiniHorizontalTimelineProps {
  milestones: TimelineMilestoneModel[];
}

export function MiniHorizontalTimeline({ milestones }: MiniHorizontalTimelineProps) {
  if (milestones.length === 0) {
    return null;
  }

  const nodes: TimelineNodeItem[] = milestones.map((m) => ({
    id: m.id,
    label: m.label,
    date: formatProjectDateShort(m.date),
    status: milestoneToNodeStatus(m.state),
    documentUrl: m.documentUrl,
  }));

  return (
    <div className="project-h-timeline project-h-timeline--mini">
      <div className="project-h-timeline-track" role="group" aria-label="Project milestone timeline preview">
        <HorizontalTimelineTrack nodes={nodes} />
      </div>
    </div>
  );
}
