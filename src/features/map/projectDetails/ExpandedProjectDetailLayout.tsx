import type { ProjectDetail } from "../../../shared/api/contracts";
import type { MapMarker, MarkerCategory } from "../../../shared/map/mapTypes";
import {
  ExternalLinkIcon,
  HousingIcon,
  InfrastructureIcon,
  SidebarCollapseIcon,
  TransitIcon,
} from "../../../shared/ui/visicIcons";
import { StatusBadge } from "./StatusBadge";
import { CardHorizontalTimeline, milestonesToCardTimelineNodes } from "./CardHorizontalTimeline";
import type { TimelineMilestoneModel } from "./timelineMilestones";

type VoteRow = {
  key: string;
  name: string;
  districtId: number | null;
  memberId: number | null;
};

type VoteGroups = { Yes: VoteRow[]; No: VoteRow[]; Absent: VoteRow[] };

interface ExpandedProjectDetailLayoutProps {
  marker: MapMarker | null;
  detail: ProjectDetail;
  title: string;
  category: string;
  overviewBody: string;
  externalUrl: string | null;
  status: string;
  voteRows: VoteGroups;
  voteTally: { yes: number; no: number; absent: number };
  primaryMoverId: number | null;
  votingRecordFooter: string | null;
  horizontalMilestones: TimelineMilestoneModel[];
  onCollapse: () => void;
  onExploreMap: () => void;
}

function categoryIcon(cat: MarkerCategory | undefined) {
  const props = { width: 22, height: 22, className: "project-expanded-cat-icon", "aria-hidden": true as const };
  if (cat === "housing") {
    return <HousingIcon {...props} />;
  }
  if (cat === "transit") {
    return <TransitIcon {...props} />;
  }
  return <InfrastructureIcon {...props} />;
}

export function ExpandedProjectDetailLayout({
  marker,
  detail,
  title,
  category,
  overviewBody,
  externalUrl,
  status,
  voteRows,
  voteTally,
  primaryMoverId,
  votingRecordFooter,
  horizontalMilestones,
  onCollapse,
  onExploreMap,
}: ExpandedProjectDetailLayoutProps) {
  const cardTimelineNodes = milestonesToCardTimelineNodes(horizontalMilestones);

  return (
    <div className="project-expanded-root">
      <button
        type="button"
        className="project-expanded-collapse-fab"
        aria-label="Collapse project panel"
        onClick={onCollapse}
      >
        <SidebarCollapseIcon width={18} height={18} />
      </button>

      <div className="project-expanded-container">
        <div className="project-expanded-stack">
          <header className="project-expanded-header">
            <div className="project-expanded-title-row">
              <h1 className="project-expanded-title">{title}</h1>
              <div className="project-expanded-title-meta">
                {externalUrl ? (
                  <a
                    className="project-expanded-link-icon"
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open primary project document in a new tab"
                  >
                    <ExternalLinkIcon width={22} height={22} />
                  </a>
                ) : null}
                <span className="project-expanded-badge-wrap">
                  <StatusBadge status={status} project={detail.project} />
                </span>
              </div>
            </div>

            <p className="project-expanded-subtitle">
              {categoryIcon(marker?.category)}
              <span>{category}</span>
            </p>

            <p className="project-expanded-description">{overviewBody}</p>
          </header>

          <div className="project-expanded-grid">
            <section className="project-saas-card project-saas-card--votes" id="voting-record-card" aria-labelledby="expanded-voting-heading">
              <h2 id="expanded-voting-heading" className="project-saas-card-title project-saas-card-title--center">
                Voting Record ({voteTally.yes}-{voteTally.no}-{voteTally.absent})
              </h2>
              <div className="project-expanded-vote-columns">
                {(["Yes", "No", "Absent"] as const).map((sectionKey) => (
                  <div key={sectionKey} className={`project-expanded-vote-col project-expanded-vote-col--${sectionKey.toLowerCase()}`}>
                    <h3 className="project-expanded-vote-col-label">{sectionKey}</h3>
                    {voteRows[sectionKey].length > 0 ? (
                      <ul className="project-expanded-vote-list">
                        {voteRows[sectionKey].map((row, rowIndex) => {
                          const highlightYes =
                            sectionKey === "Yes" &&
                            (row.memberId === primaryMoverId || (primaryMoverId == null && rowIndex === 0));
                          return (
                            <li
                              key={row.key}
                              className={highlightYes ? "project-expanded-vote-item project-expanded-vote-item--highlight" : "project-expanded-vote-item"}
                            >
                              {row.name}
                              {row.districtId != null ? <span className="project-expanded-vote-district"> ({row.districtId})</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="project-expanded-vote-empty">None</p>
                    )}
                  </div>
                ))}
              </div>
              {votingRecordFooter ? (
                <footer className="project-expanded-vote-footer">{votingRecordFooter}</footer>
              ) : null}
            </section>

            <section className="project-saas-card project-saas-card--placeholder" aria-labelledby="expanded-viz-heading">
              <h2 id="expanded-viz-heading" className="project-saas-card-title">
                Data Visualization
              </h2>
              <p className="project-expanded-placeholder-body">
                Charts and visual analytics will appear here in a future release.
              </p>
            </section>
          </div>

          {cardTimelineNodes.length > 0 ? (
            <section className="project-saas-card project-saas-card--timeline" aria-labelledby="expanded-timeline-heading">
              <h2 id="expanded-timeline-heading" className="project-saas-card-title">
                Timeline
              </h2>
              <CardHorizontalTimeline nodes={cardTimelineNodes} />
            </section>
          ) : null}

          <div className="project-expanded-footer">
            <button type="button" className="project-expanded-open-map" onClick={onExploreMap}>
              Open Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
