import type { ProjectDetail } from "../../../shared/api/contracts";
import type { MarkerCategory } from "../../../shared/map/mapTypes";
import { CategoryPill } from "../../../shared/ui/CategoryPill";
import { formatName } from "../../../shared/formatPersonName";
import { CardHorizontalTimeline, milestonesToCardTimelineNodes } from "./CardHorizontalTimeline";
import { buildMoverRows } from "./moverRows";
import { MoversTable } from "./MoversTable";
import { formatProjectDateLong } from "./formatProjectDate";
import { SidebarVoteTallyValue, sidebarHasVoteTallyDisplay } from "./sidebarVoteTally";
import { StatusBadge } from "./StatusBadge";
import type { TimelineMilestoneModel } from "./timelineMilestones";
import { ProjectAffiliationChips, hasAnyAffiliations } from "./ProjectAffiliations";
import { useMemo } from "react";

const SIDEBAR_COLLAPSE_ICON_SRC = "/collapse-icon.svg";

type VoteRow = {
  key: string;
  name: string;
  districtId: number | null;
  memberId: number | null;
};

type VoteGroups = { Yes: VoteRow[]; No: VoteRow[]; Absent: VoteRow[] };

type VoteSectionKey = keyof VoteGroups;

interface ExpandedProjectDetailLayoutProps {
  detail: ProjectDetail;
  title: string;
  category: MarkerCategory;
  summary: string;
  externalUrl: string | null;
  status: string;
  voteRows: VoteGroups;
  voteTally: { yes: number; no: number; absent: number };
  primaryMoverId: number | null;
  votingRecordFooter: string | null;
  horizontalMilestones: TimelineMilestoneModel[];
  onCollapse: () => void;
  onExploreMap: () => void;
  isClosing?: boolean;
  onOpenChat?: () => void;
}

function cardHoverClassName() {
  return "transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]";
}

function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ height: 1, width: "100%", background: "#e5e7eb" }}
    />
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="project-expanded-open-map" onClick={onClick}>
      {children}
    </button>
  );
}

function ProjectHeader({
  detail,
  title,
  category,
  summary,
  externalUrl,
  status,
}: {
  detail: ProjectDetail;
  title: string;
  category: MarkerCategory;
  summary: string;
  externalUrl: string | null;
  status: string;
}) {
  return (
    <header className="project-sidebar-header project-expanded-sheet-header">
      <div className="project-sidebar-title-band" style={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="project-sidebar-title-cluster" style={{ minWidth: 0 }}>
          <h1 className="project-sidebar-title">
            <span className="project-sidebar-title-text">{title}</span>
          </h1>
          {externalUrl ? (
            <a
              className="project-view-source-link"
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          ) : null}
          {detail.project.id ? (
            <p className="project-sidebar-council-file">Council File {detail.project.id}</p>
          ) : null}
          <CategoryPill category={category} />
          {summary.trim() ? <p className="project-expanded-description">{summary}</p> : null}
        </div>

        <div className="project-sidebar-status-column" style={{ alignItems: "flex-start" }}>
          <StatusBadge status={status} project={detail.project} />
        </div>
      </div>
    </header>
  );
}

function VotingCard({
  voteTally,
  voteRows,
  primaryMoverId,
  votingRecordFooter,
}: {
  voteTally: { yes: number; no: number; absent: number };
  voteRows: VoteGroups;
  primaryMoverId: number | null;
  votingRecordFooter: string | null;
}) {
  const sections = ["Yes", "No", "Absent"] as const satisfies readonly VoteSectionKey[];

  return (
    <section
      className={`project-saas-card project-saas-card--votes project-expanded-vote-card ${cardHoverClassName()}`}
      id="voting-record-card"
      aria-labelledby="expanded-voting-heading"
    >
      <div className="project-expanded-voting-record-block">
        <h2 id="expanded-voting-heading" className="project-saas-card-title project-saas-card-title--center">
          Voting Record ({voteTally.yes}-{voteTally.no}-{voteTally.absent})
        </h2>
        <Divider className="mb-6" />

        <div className="project-expanded-vote-columns" role="presentation">
          {sections.map((sectionKey) => (
            <div
              key={sectionKey}
              className={`project-expanded-vote-col project-expanded-vote-col--${sectionKey.toLowerCase()}`}
            >
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
                        className={
                          highlightYes
                            ? "project-expanded-vote-item project-expanded-vote-item--highlight"
                            : "project-expanded-vote-item"
                        }
                      >
                        {formatName(row.name)}
                        {row.districtId != null ? (
                          <span className="project-expanded-vote-district"> ({row.districtId})</span>
                        ) : null}
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
      </div>
    </section>
  );
}

function AboutCard({ about }: { about: string }) {
  return (
    <section
      className={`project-saas-card ${cardHoverClassName()}`}
      aria-labelledby="expanded-about-heading"
    >
      <h2 id="expanded-about-heading" className="project-saas-card-title">
        About
      </h2>
      <p className="project-sidebar-overview-body">{about}</p>
    </section>
  );
}

function ProjectOverviewCard({
  detail,
  voteTally,
}: {
  detail: ProjectDetail;
  voteTally: { yes: number; no: number; absent: number };
}) {
  const moverRows = buildMoverRows(detail);
  const showOverviewMeta =
    detail.project.district_id != null ||
    Boolean(detail.project.start_date) ||
    Boolean(detail.project.end_date) ||
    sidebarHasVoteTallyDisplay(detail) ||
    moverRows.length > 0;

  return (
    <section className={`project-saas-card project-saas-card--votes ${cardHoverClassName()}`} aria-labelledby="expanded-overview-heading">
      <div className="project-expanded-voting-record-block">
        <h2 id="expanded-overview-heading" className="project-saas-card-title project-saas-card-title--center">
          Project Overview
        </h2>
        <Divider className="mb-6" />

        {showOverviewMeta ? (
          <dl className="project-sidebar-meta">
            {detail.project.district_id != null ? (
              <div className="project-sidebar-meta-row">
                <dt>Council District:</dt>
                <dd>{detail.project.district_id}</dd>
              </div>
            ) : null}
            {detail.project.start_date ? (
              <div className="project-sidebar-meta-row">
                <dt>Start Date:</dt>
                <dd>{formatProjectDateLong(detail.project.start_date)}</dd>
              </div>
            ) : null}
            {detail.project.end_date ? (
              <div className="project-sidebar-meta-row">
                <dt>End Date:</dt>
                <dd>{formatProjectDateLong(detail.project.end_date)}</dd>
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
            {moverRows.length > 0 ? (
              <div className="project-sidebar-meta-row project-sidebar-meta-row--movers">
                <dt>Movers:</dt>
                <dd>
                  <MoversTable rows={moverRows} />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function AffiliationsCard({ detail }: { detail: ProjectDetail }) {
  if (!hasAnyAffiliations(detail.affiliations)) {
    return null;
  }

  return (
    <section
      className={`project-saas-card project-saas-card--votes project-expanded-affiliations-card ${cardHoverClassName()}`}
      aria-labelledby="expanded-affiliations-heading"
    >
      <div className="project-expanded-voting-record-block">
        <h2 id="expanded-affiliations-heading" className="project-saas-card-title project-saas-card-title--center">
          Related Bodies
        </h2>
        <Divider className="mb-6" />
        <ProjectAffiliationChips affiliations={detail.affiliations} />
      </div>
    </section>
  );
}

function TimelineItem({
  date,
  label,
  description,
  documentUrl,
}: {
  date: string;
  label: string;
  description?: string | null;
  documentUrl: string | null;
}) {
  const content = (
    <>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{date}</div>
      <div style={{ fontSize: 14, color: "#111827", fontWeight: 600, marginTop: 6 }}>{label}</div>
      {description?.trim() ? (
        <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6, lineHeight: 1.45 }}>{description}</div>
      ) : null}
    </>
  );

  if (documentUrl) {
    return (
      <a
        href={documentUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "none" }}
      >
        {content}
      </a>
    );
  }
  return <div>{content}</div>;
}

function TimelineCard({ milestones }: { milestones: TimelineMilestoneModel[] }) {
  const nodes = useMemo(() => milestonesToCardTimelineNodes(milestones), [milestones]);

  return (
    <section
      className={`project-saas-card project-saas-card--timeline project-expanded-timeline-card ${cardHoverClassName()}`}
      aria-labelledby="expanded-timeline-heading"
    >
      <div className="project-expanded-timeline-block">
        <h2 id="expanded-timeline-heading" className="project-saas-card-title">
          Timeline
        </h2>
        {nodes.length > 0 ? (
          <div style={{ width: "100%" }}>
            <CardHorizontalTimeline nodes={nodes} />
            {nodes.length > 1 ? <p className="project-card-htimeline-scroll-hint">Scroll to the right</p> : null}
            <div style={{ marginTop: 18, display: "none" }}>
              {/* reserved: timeline item list if needed */}
              {nodes.map((n) => (
                <TimelineItem key={n.id} date={n.dateLabel} label={n.description} description={null} documentUrl={n.documentUrl} />
              ))}
            </div>
          </div>
        ) : (
          <p className="project-expanded-timeline-empty">No timeline data available.</p>
        )}
      </div>
    </section>
  );
}

export function ExpandedProjectDetailLayout({
  detail,
  title,
  category,
  summary,
  externalUrl,
  status,
  voteRows,
  voteTally,
  primaryMoverId,
  votingRecordFooter,
  horizontalMilestones,
  onCollapse,
  onExploreMap,
  isClosing,
  onOpenChat,
}: ExpandedProjectDetailLayoutProps) {
  const about = detail.project.about?.trim() ?? "";

  return (
    <div className={`project-expanded-dock font-schibsted${isClosing ? " is-closing" : ""}`}>
      <section
        className="project-expanded-bottom-sheet project-expanded-bottom-sheet--scroll"
        aria-label="Project details expanded"
      >
        <button
          type="button"
          className="project-expanded-collapse-fab project-expanded-collapse-fab--on-sheet"
          aria-label="Collapse project panel"
          onClick={onCollapse}
        >
          <img
            className="project-sidebar-edge-icon-img"
            src={SIDEBAR_COLLAPSE_ICON_SRC}
            alt=""
            width={12}
            height={12}
            decoding="async"
          />
        </button>
        <div className="project-expanded-sheet-scroll">
          <ProjectHeader
            detail={detail}
            title={title}
            category={category}
            summary={summary}
            externalUrl={externalUrl}
            status={status}
          />

          {about ? <AboutCard about={about} /> : null}

          <section className="project-expanded-grid" aria-label="Project overview cards">
            <ProjectOverviewCard detail={detail} voteTally={voteTally} />
            <VotingCard
              voteTally={voteTally}
              voteRows={voteRows}
              primaryMoverId={primaryMoverId}
              votingRecordFooter={votingRecordFooter}
            />
          </section>

          <AffiliationsCard detail={detail} />

          <TimelineCard milestones={horizontalMilestones} />

          <div className="project-expanded-footer">
            {onOpenChat ? (
              <button type="button" className="project-expanded-ask-chat" onClick={onOpenChat}>
                Ask about this file
              </button>
            ) : null}
            <PrimaryButton onClick={onExploreMap}>Open Map</PrimaryButton>
          </div>
        </div>
      </section>
    </div>
  );
}
