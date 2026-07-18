import { useState } from "react";
import type { CSSProperties } from "react";

import { ActivityFileSummaryModal } from "./ActivityFileSummaryModal";
import type { VerticalTimelineItem } from "./timelineMilestones";

export interface VerticalTimelineViewProps {
  items: VerticalTimelineItem[];
  /** Return to the main project overview (sidebar default). */
  onOverviewClick: () => void;
}

/** The document whose summary the modal is currently showing. */
interface OpenSummary {
  title: string;
  date: string | null;
  activityFileSummary: string;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function VerticalTimelineView({ items, onOverviewClick }: VerticalTimelineViewProps) {
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="project-v-timeline" role="region" aria-label="Project timeline overview">
      <div className="project-v-timeline-overview-row">
        <button
          type="button"
          className="project-v-timeline-overview-heading"
          onClick={onOverviewClick}
          aria-label="Back to project overview"
        >
          <span className="project-v-timeline-overview-chevron" aria-hidden="true">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Back to Overview
        </button>
      </div>

      <div className="project-v-timeline-inner">
        <ul className="project-v-timeline-rows">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="project-v-timeline-row"
              style={{ "--v-stagger": index } as CSSProperties}
            >
              <div className="project-v-timeline-rail" aria-hidden="true">
                <span className="project-v-timeline-node">
                  <CheckIcon />
                </span>
              </div>

              <div className="project-v-timeline-content">
                <p className="project-v-timeline-date">{item.date}</p>
                <p className="project-v-timeline-desc">{item.description}</p>

                {item.documents.length > 0 ? (
                  <div className="project-v-timeline-docs">
                    {item.documents.map((doc, docIndex) => {
                      const label = doc.title?.trim() || "Source document";
                      const summary = doc.activityFileSummary;
                      if (!doc.url && !summary) {
                        // Nothing actionable — skip rather than render an empty row.
                        return null;
                      }
                      return (
                        <div
                          className="project-v-timeline-doc"
                          key={`${item.id}-doc-${docIndex}-${doc.url ?? "nourl"}`}
                        >
                          {doc.url ? (
                            <a
                              className="project-v-timeline-action"
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Source
                              <span className="project-v-timeline-doc-title"> · {label}</span>
                            </a>
                          ) : null}
                          {summary ? (
                            <button
                              type="button"
                              className="project-v-timeline-action project-v-timeline-action--summarize"
                              onClick={() =>
                                setOpenSummary({
                                  title: label,
                                  date: item.date,
                                  activityFileSummary: summary,
                                })
                              }
                            >
                              Summary
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {openSummary ? (
        <ActivityFileSummaryModal
          title={openSummary.title}
          date={openSummary.date}
          activityFileSummary={openSummary.activityFileSummary}
          onClose={() => setOpenSummary(null)}
        />
      ) : null}
    </div>
  );
}
