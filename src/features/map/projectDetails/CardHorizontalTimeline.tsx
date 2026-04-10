import type { CSSProperties } from "react";

import type { TimelineMilestoneModel } from "./timelineMilestones";
import { formatProjectDateLong } from "./formatProjectDate";

export interface CardTimelineNode {
  id: string;
  description: string;
  dateLabel: string;
  documentUrl: string | null;
}

export function milestonesToCardTimelineNodes(milestones: TimelineMilestoneModel[]): CardTimelineNode[] {
  return milestones.map((m) => ({
    id: m.id,
    description: m.label,
    dateLabel: formatProjectDateLong(m.date),
    documentUrl: m.documentUrl,
  }));
}

function DescriptionBlock({
  text,
  documentUrl,
}: {
  text: string;
  documentUrl: string | null;
}) {
  if (documentUrl) {
    return (
      <a
        href={documentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="project-card-htimeline-desc-link"
      >
        {text}
      </a>
    );
  }
  return <span className="project-card-htimeline-desc">{text}</span>;
}

interface CardHorizontalTimelineProps {
  nodes: CardTimelineNode[];
}

/**
 * Full-width horizontal timeline for expanded project view: solid green bar,
 * hollow nodes, alternating description/date above and below per column.
 */
export function CardHorizontalTimeline({ nodes }: CardHorizontalTimelineProps) {
  if (nodes.length === 0) {
    return null;
  }

  const colMin = "5.75rem";
  const gridCols = `repeat(${nodes.length}, minmax(${colMin}, 1fr))`;

  return (
    <div
      className="project-card-htimeline"
      role="group"
      aria-label="Project timeline"
      style={{ "--project-card-htimeline-cols": nodes.length } as CSSProperties}
    >
      <div className="project-card-htimeline-scroll">
        <div className="project-card-htimeline-scroll-sizer">
          <div className="project-card-htimeline-labels-top" style={{ gridTemplateColumns: gridCols }}>
            {nodes.map((n, index) => {
              const isEven = index % 2 === 0;
              return (
                <div key={`t-${n.id}`} className="project-card-htimeline-cell project-card-htimeline-cell--top">
                  {isEven ? (
                    <DescriptionBlock text={n.description} documentUrl={n.documentUrl} />
                  ) : (
                    <span className="project-card-htimeline-date">{n.dateLabel}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="project-card-htimeline-track">
            <div className="project-card-htimeline-line" aria-hidden="true" />
            <div className="project-card-htimeline-nodes" style={{ gridTemplateColumns: gridCols }}>
              {nodes.map((n) => (
                <div key={`n-${n.id}`} className="project-card-htimeline-node-cell">
                  <div className="project-card-htimeline-node" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          <div className="project-card-htimeline-labels-bottom" style={{ gridTemplateColumns: gridCols }}>
            {nodes.map((n, index) => {
              const isEven = index % 2 === 0;
              return (
                <div key={`b-${n.id}`} className="project-card-htimeline-cell project-card-htimeline-cell--bottom">
                  {isEven ? (
                    <span className="project-card-htimeline-date">{n.dateLabel}</span>
                  ) : (
                    <DescriptionBlock text={n.description} documentUrl={n.documentUrl} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
