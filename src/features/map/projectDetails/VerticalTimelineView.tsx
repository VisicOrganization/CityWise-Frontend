import type { CSSProperties } from "react";

import type { VerticalTimelineItem } from "./timelineMilestones";

export interface VerticalTimelineViewProps {
  items: VerticalTimelineItem[];
  /** Return to the main project overview (sidebar default). */
  onOverviewClick: () => void;
}

function DescriptionText({
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
        className="project-v-timeline-desc-link"
      >
        {text}
      </a>
    );
  }
  return <span className="project-v-timeline-desc">{text}</span>;
}

export function VerticalTimelineView({ items, onOverviewClick }: VerticalTimelineViewProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="project-v-timeline" role="region" aria-label="Project timeline overview">
      <button
        type="button"
        className="project-v-timeline-overview-heading"
        onClick={onOverviewClick}
        aria-label="Back to project overview"
      >
        Back to Overview
      </button>

      <div className="project-v-timeline-inner">
        <div className="project-v-timeline-line" aria-hidden="true" />

        <ul className="project-v-timeline-rows">
          {items.map((item, index) => {
            const isEven = index % 2 === 0;
            const dateEl = (
              <span className="project-v-timeline-date">{item.date}</span>
            );
            const descEl = (
              <DescriptionText text={item.description} documentUrl={item.documentUrl} />
            );

            return (
              <li
                key={item.id}
                className="project-v-timeline-row"
                style={{ "--v-stagger": index } as CSSProperties}
              >
                <div className="project-v-timeline-row-grid">
                  <div className="project-v-timeline-cell project-v-timeline-cell--left">
                    {isEven ? dateEl : descEl}
                  </div>
                  <div className="project-v-timeline-node-wrap">
                    <div className="project-v-timeline-node" aria-hidden="true" />
                  </div>
                  <div className="project-v-timeline-cell project-v-timeline-cell--right">
                    {isEven ? descEl : dateEl}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
