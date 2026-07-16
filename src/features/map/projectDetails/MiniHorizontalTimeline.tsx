import type { CSSProperties } from "react";

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

function dashSegmentIndex(nodeCount: number): number | null {
  const segCount = nodeCount - 1;
  if (segCount < 2) {
    return null;
  }
  return Math.floor(segCount / 2);
}

/** Mini sidebar: four milestones only — narrower outer pairs, wider middle (must match CSS flex-grow). */
const MINI_FOUR_NODE_COLUMN_GROW = [0.36, 0.98, 0.94, 0.42] as const;

function nodeCenterFractions(grow: readonly number[]): number[] {
  const sum = grow.reduce((a, b) => a + b, 0);
  return grow.map((g, k) => {
    let acc = 0;
    for (let j = 0; j < k; j += 1) {
      acc += grow[j];
    }
    return (acc + g / 2) / sum;
  });
}

/** Slot centered on midpoint between milestone i and i+1; width matches node spacing + bleed for gap-free solids */
function segmentSlotLayout(segmentIndex: number, nodeCount: number): CSSProperties {
  if (nodeCount === 4) {
    const centers = nodeCenterFractions(MINI_FOUR_NODE_COLUMN_GROW);
    const c0 = centers[segmentIndex];
    const c1 = centers[segmentIndex + 1];
    const midPct = ((c0 + c1) / 2) * 100;
    const spanPct = (c1 - c0) * 100;
    return {
      left: `${midPct}%`,
      width: `calc(${spanPct}% + var(--h-timeline-seg-bleed, 4px))`,
      transform: "translate(-50%, -50%)",
      top: "50%",
    };
  }

  return {
    left: `calc(100% * ${segmentIndex + 1} / ${nodeCount})`,
    width: `calc(100% / ${nodeCount} + var(--h-timeline-seg-bleed, 4px))`,
    transform: "translate(-50%, -50%)",
    top: "50%",
  };
}

interface HorizontalTimelineTrackProps {
  nodes: TimelineNodeItem[];
  onExpandTimeline?: () => void;
}

/** Segmented horizontal bar with labels; used for the compact sidebar preview. */
export function HorizontalTimelineTrack({ nodes, onExpandTimeline }: HorizontalTimelineTrackProps) {
  if (nodes.length === 0) {
    return null;
  }

  const n = nodes.length;
  const dashIx = dashSegmentIndex(n);

  const containerClass =
    n === 4 ? "project-h-timeline-container project-h-timeline-container--four" : "project-h-timeline-container";

  return (
    <div className={containerClass}>
      {onExpandTimeline ? (
        <div className="project-h-timeline-expand-row">
          <button
            type="button"
            className="project-h-timeline-expand-link"
            onClick={onExpandTimeline}
            aria-label="Open expanded timeline overview"
          >
            View Full Timeline
            <span className="project-h-timeline-expand-chevron" aria-hidden="true">
              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 12H20M20 12L14 6M20 12L14 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      ) : null}

      <div className="project-h-timeline-labels-top">
        {nodes.map((n) => (
          <div key={n.id} className="project-h-timeline-label-top">
            <div className="project-h-timeline-label-top-inner">
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
          </div>
        ))}
      </div>

      <div className="project-h-timeline-bar project-h-timeline-bar--segmented">
        <div className="project-h-timeline-bar-mid">
          <div className="project-h-timeline-line-between-nodes" aria-hidden="true">
            {n > 1 ? (
              <div className="project-h-timeline-line-segments">
                {Array.from({ length: n - 1 }, (_, i) => (
                  <div
                    key={i}
                    className="project-h-timeline-seg-slot"
                    style={segmentSlotLayout(i, n)}
                    aria-hidden="true"
                  >
                    {dashIx !== null && i === dashIx ? (
                      <div className="project-h-timeline-seg-bridge">
                        <div className="project-h-timeline-seg-bridge-slab" />
                        <div className="project-h-timeline-seg-bridge-dash" />
                        <div className="project-h-timeline-seg-bridge-slab" />
                      </div>
                    ) : (
                      <div className="project-h-timeline-seg-slot-solid" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="project-h-timeline-nodes">
            {nodes.map((node) => (
              <HorizontalTimelineNode
                key={node.id}
                label={node.label}
                date={node.date}
                status={node.status}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="project-h-timeline-labels-bottom">
        {nodes.map((n) => (
          <div key={n.id} className="project-h-timeline-label-bottom">
            <span className="project-h-timeline-label-bottom-inner">{n.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MiniHorizontalTimelineProps {
  milestones: TimelineMilestoneModel[];
  onExpandTimeline?: () => void;
}

export function MiniHorizontalTimeline({ milestones, onExpandTimeline }: MiniHorizontalTimelineProps) {
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
    <div
      className="project-h-timeline project-h-timeline--mini"
      style={{ "--h-timeline-n": milestones.length } as CSSProperties}
    >
      <div className="project-h-timeline-track" role="group" aria-label="Project milestone timeline preview">
        <HorizontalTimelineTrack nodes={nodes} onExpandTimeline={onExpandTimeline} />
      </div>
    </div>
  );
}
