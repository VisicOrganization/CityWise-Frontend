import type { ProjectDetail } from "../../../shared/api/contracts";
import { formatPersonNameForDisplay } from "../../../shared/formatPersonName";
import { ExternalLinkIcon, SidebarCollapseIcon } from "../../../shared/ui/visicIcons";
import { formatProjectDateLong } from "./formatProjectDate";
import { StatusBadge } from "./StatusBadge";
import { CardHorizontalTimeline, milestonesToCardTimelineNodes } from "./CardHorizontalTimeline";
import type { TimelineMilestoneModel } from "./timelineMilestones";
import { SidebarVoteTallyValue, sidebarHasVoteTallyDisplay } from "./sidebarVoteTally";

type VoteRow = {
  key: string;
  name: string;
  districtId: number | null;
  memberId: number | null;
};

type VoteGroups = { Yes: VoteRow[]; No: VoteRow[]; Absent: VoteRow[] };

interface ExpandedProjectDetailLayoutProps {
  detail: ProjectDetail;
  title: string;
  category: string;
  categoryAccent: string;
  overviewSummary: string | null;
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

export function ExpandedProjectDetailLayout({
  detail,
  title,
  category,
  categoryAccent,
  overviewSummary,
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
          <header className="project-expanded-header project-expanded-header--figma">
            <div
              className="project-sidebar-category-bar project-sidebar-category-bar--expanded"
              style={{ backgroundColor: categoryAccent }}
              aria-hidden="true"
            />
            <div className="project-expanded-title-band">
              <h1 className="project-expanded-title project-expanded-title--figma">{title}</h1>
              <div className="project-sidebar-status-column">
                <StatusBadge status={status} project={detail.project} />
                {externalUrl ? (
                  <a
                    className="project-sidebar-tool-btn project-sidebar-tool-btn--32"
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open primary project document in a new tab"
                  >
                    <ExternalLinkIcon width={18} height={18} />
                  </a>
                ) : null}
              </div>
            </div>
            <p className="project-expanded-subtitle project-expanded-subtitle--plain">{category}</p>
            {overviewSummary ? (
              <p className="project-expanded-description project-expanded-description--figma">{overviewSummary}</p>
            ) : null}
            {detail.project.district_id != null ||
            detail.project.meeting_date ||
            (typeof detail.project.vote_action === "string" && detail.project.vote_action.trim()) ||
            sidebarHasVoteTallyDisplay(detail) ? (
              <dl className="project-sidebar-meta project-sidebar-meta--expanded">
                {detail.project.district_id != null ? (
                  <div className="project-sidebar-meta-row">
                    <dt>Council District:</dt>
                    <dd>{detail.project.district_id}</dd>
                  </div>
                ) : null}
                {detail.project.meeting_date ? (
                  <div className="project-sidebar-meta-row">
                    <dt>Meeting Date:</dt>
                    <dd>{formatProjectDateLong(detail.project.meeting_date)}</dd>
                  </div>
                ) : null}
                {typeof detail.project.vote_action === "string" && detail.project.vote_action.trim() ? (
                  <div className="project-sidebar-meta-row">
                    <dt>Vote Action:</dt>
                    <dd>{detail.project.vote_action.trim()}</dd>
                  </div>
                ) : null}
                {sidebarHasVoteTallyDisplay(detail) ? (
                  <div className="project-sidebar-meta-row">
                    <dt>Vote Tally:</dt>
                    <dd>
                      <SidebarVoteTallyValue detail={detail} voteTally={voteTally} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {detail.movers.primary.length > 0 ? (
              <div className="project-sidebar-movers">
                <h4 className="project-sidebar-movers-label">Primary Movers:</h4>
                <p className="project-sidebar-movers-text">
                  {detail.movers.primary.map((m) => formatPersonNameForDisplay(m.name)).join(", ")}
                </p>
              </div>
            ) : null}
            {detail.movers.secondary.length > 0 ? (
              <div className="project-sidebar-movers">
                <h4 className="project-sidebar-movers-label">Secondary Movers:</h4>
                <p className="project-sidebar-movers-text">
                  {detail.movers.secondary.map((m) => formatPersonNameForDisplay(m.name)).join(", ")}
                </p>
              </div>
            ) : null}
          </header>

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
                            {formatPersonNameForDisplay(row.name)}
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
            {votingRecordFooter ? <footer className="project-expanded-vote-footer">{votingRecordFooter}</footer> : null}
          </section>

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
              Explore Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
