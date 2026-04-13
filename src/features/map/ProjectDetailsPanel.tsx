import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ProjectDetail } from "../../shared/api/contracts";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { primaryHttpDocumentUrlFromDetail } from "../../shared/map/projectDocuments";
import type { MapMarker } from "../../shared/map/mapTypes";
import {
  BallotIcon,
  ChartLineIcon,
  CloseIcon,
  ExternalLinkIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
} from "../../shared/ui/visicIcons";
import { formatProjectDateLong, formatUsNumericDate } from "./projectDetails/formatProjectDate";
import { MiniHorizontalTimeline } from "./projectDetails/MiniHorizontalTimeline";
import {
  buildFallbackMilestones,
  buildTimelineMilestones,
  buildVerticalTimelineItems,
} from "./projectDetails/timelineMilestones";
import { VerticalTimelineView } from "./projectDetails/VerticalTimelineView";
import { StatusBadge } from "./projectDetails/StatusBadge";
import { ExpandedProjectDetailLayout } from "./projectDetails/ExpandedProjectDetailLayout";
import { SidebarVoteTallyValue, sidebarHasVoteTallyDisplay } from "./projectDetails/sidebarVoteTally";

function normalizeVoteGroup(vote: string | null): "Yes" | "No" | "Absent" {
  const normalized = vote?.trim().toLowerCase();

  if (normalized === "yes" || normalized === "aye") {
    return "Yes";
  }

  if (normalized === "no" || normalized === "nay") {
    return "No";
  }

  return "Absent";
}

type VoteRow = {
  key: string;
  name: string;
  districtId: number | null;
  memberId: number | null;
};

function parseVoteGivenTally(voteGiven: unknown): { yes: number; no: number; absent: number } | null {
  if (voteGiven == null) {
    return null;
  }
  const str =
    typeof voteGiven === "string"
      ? voteGiven.trim()
      : typeof voteGiven === "number" && Number.isFinite(voteGiven)
        ? String(voteGiven)
        : null;
  if (!str) {
    return null;
  }

  const inner = str.replace(/^\(|\)$/g, "");
  const parts = inner.split(/\s*-\s*/).map((part) => Number.parseInt(part.trim(), 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return { yes: parts[0] ?? 0, no: parts[1] ?? 0, absent: parts[2] ?? 0 };
  }

  return null;
}

/** Figma map pins: brown housing #8d6e63, blue transit #3779f4, orange infrastructure #e67e22 */
function categoryAccentBarColor(marker: MapMarker | null): string {
  const cat = marker?.category;
  if (cat === "transit") {
    return "#3779f4";
  }
  if (cat === "housing") {
    return "#8d6e63";
  }
  return "#e67e22";
}

function categoryLine(marker: MapMarker | null, detail: ProjectDetail | null): string {
  const base =
    marker?.category === "housing"
      ? "Housing"
      : marker?.category === "transit"
        ? "Transportation"
        : "Infrastructure";
  const topics = detail?.address_info?.topics?.filter((t) => t.trim().length > 0) ?? [];
  if (topics.length > 0) {
    return `${base} & ${topics[0]}`;
  }
  return `${base} & Infrastructure`;
}

interface ProjectDetailsPanelProps {
  marker: MapMarker | null;
  detail: ProjectDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  onExploreMap: () => void;
}

const VOTE_POPOVER_GAP_PX = 8;

export function ProjectDetailsPanel({
  marker,
  detail,
  isLoading,
  errorMessage,
  onExploreMap,
}: ProjectDetailsPanelProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const voteButtonRef = useRef<HTMLButtonElement>(null);
  const [isVotingPopoverOpen, setIsVotingPopoverOpen] = useState(false);
  const [votePopoverPlacement, setVotePopoverPlacement] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const [timelineViewOpen, setTimelineViewOpen] = useState(false);
  const [sidebarWidthExpanded, setSidebarWidthExpanded] = useState(false);

  useEffect(() => {
    setTimelineViewOpen(false);
    setSidebarWidthExpanded(false);
  }, [detail?.project.id]);

  useEffect(() => {
    if (sidebarWidthExpanded) {
      setIsVotingPopoverOpen(false);
      setTimelineViewOpen(false);
    }
  }, [sidebarWidthExpanded]);

  const title = detail?.project.title ?? marker?.label ?? "Project details";
  const status = detail?.project.status ?? "loading";

  const voteRows = useMemo(() => {
    const groups: { Yes: VoteRow[]; No: VoteRow[]; Absent: VoteRow[] } = {
      Yes: [],
      No: [],
      Absent: [],
    };

    detail?.votes?.forEach((vote, index) => {
      const bucket = normalizeVoteGroup(vote.vote);
      const memberId = vote.member?.id ?? null;
      groups[bucket].push({
        key: `${bucket}-${memberId ?? `idx-${index}`}-${vote.member?.name ?? "unknown"}`,
        name: vote.member?.name ?? "Unknown member",
        districtId: vote.member?.district_id ?? null,
        memberId,
      });
    });

    return groups;
  }, [detail]);

  const voteTally = useMemo(() => {
    if (!detail) {
      return { yes: 0, no: 0, absent: 0 };
    }

    const tallied = { yes: 0, no: 0, absent: 0 };
    const votes = detail.votes ?? [];
    for (const vote of votes) {
      const bucket = normalizeVoteGroup(vote.vote);
      if (bucket === "Yes") {
        tallied.yes += 1;
      } else if (bucket === "No") {
        tallied.no += 1;
      } else {
        tallied.absent += 1;
      }
    }

    if (votes.length > 0) {
      return tallied;
    }

    return parseVoteGivenTally(detail.project.vote_given) ?? tallied;
  }, [detail]);

  const primaryMoverId = detail?.movers?.primary?.[0]?.id ?? null;

  const updateVotePopoverPlacement = useCallback(() => {
    if (!isVotingPopoverOpen || !detail) {
      setVotePopoverPlacement(null);
      return;
    }

    const sidebarEl = sidebarRef.current;
    const btnEl = voteButtonRef.current;
    if (!sidebarEl || !btnEl) {
      setVotePopoverPlacement(null);
      return;
    }

    const sidebarRect = sidebarEl.getBoundingClientRect();
    const btnRect = btnEl.getBoundingClientRect();
    const left = Math.round(sidebarRect.right + VOTE_POPOVER_GAP_PX);
    let top = Math.round(btnRect.top);
    const edgeMargin = 12;
    const maxHeight = Math.max(
      160,
      Math.min(window.innerHeight * 0.72, window.innerHeight - top - edgeMargin),
    );
    const estimatedMinTop = window.innerHeight - maxHeight - edgeMargin;
    if (top > estimatedMinTop) {
      top = Math.max(edgeMargin, estimatedMinTop);
    }

    setVotePopoverPlacement({ top, left, maxHeight });
  }, [isVotingPopoverOpen, detail, sidebarWidthExpanded]);

  useLayoutEffect(() => {
    updateVotePopoverPlacement();
  }, [updateVotePopoverPlacement]);

  useEffect(() => {
    if (!isVotingPopoverOpen) {
      return undefined;
    }

    const onScrollOrResize = () => {
      updateVotePopoverPlacement();
    };

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isVotingPopoverOpen, updateVotePopoverPlacement]);

  const votingRecordFooter = useMemo(() => {
    if (!detail) {
      return null;
    }

    const action = detail.project.vote_action?.trim();
    const datePart = formatUsNumericDate(detail.project.meeting_date);
    if (!action && !datePart) {
      return null;
    }

    if (action && datePart) {
      return `${action} ${datePart}`;
    }

    return action ?? datePart ?? null;
  }, [detail]);

  const verticalTimelineItems = useMemo(() => {
    if (!detail) {
      return [];
    }
    return buildVerticalTimelineItems(detail);
  }, [detail]);

  const horizontalMilestones = useMemo(() => {
    if (!detail) {
      return [];
    }
    const fromEntries = buildTimelineMilestones(detail.timeline);
    if (fromEntries.length > 0) {
      return fromEntries;
    }
    return buildFallbackMilestones({
      start_date: detail.project.start_date,
      meeting_date: detail.project.meeting_date,
      last_changed_date: detail.project.last_changed_date,
      status: detail.project.status,
    });
  }, [detail]);

  /** Figma: no placeholder when summary empty — omit body copy entirely */
  const overviewSummary = useMemo((): string | null => {
    if (!detail) {
      return null;
    }
    const main = (detail.project.about ?? detail.project.summary)?.trim();
    return main && main.length > 0 ? main : null;
  }, [detail]);

  const externalUrl = primaryHttpDocumentUrlFromDetail(detail);
  const category = categoryLine(marker, detail);
  const categoryAccent = useMemo(() => categoryAccentBarColor(marker), [marker]);

  const votingRecordDialog =
    isVotingPopoverOpen && detail && votePopoverPlacement
      ? createPortal(
          <div
            className="voting-popover project-sidebar-voting-popover voting-popover--portal"
            role="dialog"
            aria-label="Voting record"
            aria-modal="true"
            style={{
              position: "fixed",
              top: votePopoverPlacement.top,
              left: votePopoverPlacement.left,
              zIndex: 100,
              maxHeight: votePopoverPlacement.maxHeight,
            }}
          >
            <div className="voting-popover-header-row">
              <div className="voting-popover-heading">
                <strong className="voting-popover-title">Voting Record</strong>
                <span className="voting-popover-tally" aria-label="Vote tally">
                  <span className="voting-popover-tally-paren">(</span>
                  <span className="voting-popover-tally-yes">{voteTally.yes}</span>
                  <span className="voting-popover-tally-sep"> · </span>
                  <span className="voting-popover-tally-no">{voteTally.no}</span>
                  <span className="voting-popover-tally-sep"> · </span>
                  <span className="voting-popover-tally-absent">{voteTally.absent}</span>
                  <span className="voting-popover-tally-paren">)</span>
                </span>
              </div>
              <button
                type="button"
                className="voting-popover-close"
                aria-label="Close voting record"
                onClick={() => setIsVotingPopoverOpen(false)}
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
            <div className="voting-popover-divider" aria-hidden="true" />

            {(["Yes", "No", "Absent"] as const).map((sectionKey, sectionIndex) => (
              <div key={sectionKey}>
                <section
                  className={`voting-popover-section voting-popover-section--${sectionKey.toLowerCase()}`}
                  aria-label={`${sectionKey} votes`}
                >
                  <h4 className="voting-popover-section-label">{sectionKey}</h4>
                  {voteRows[sectionKey].length > 0 ? (
                    <ul className="voting-popover-name-list">
                      {voteRows[sectionKey].map((row, rowIndex) => {
                        const highlightYes =
                          sectionKey === "Yes" &&
                          (row.memberId === primaryMoverId || (primaryMoverId == null && rowIndex === 0));
                        return (
                          <li
                            key={row.key}
                            className={
                              highlightYes
                                ? "voting-popover-name voting-popover-name--highlight"
                                : "voting-popover-name"
                            }
                          >
                            <span className="voting-popover-name-text">{formatPersonNameForDisplay(row.name)}</span>
                            {row.districtId != null ? (
                              <span className="voting-popover-district"> ({row.districtId})</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="voting-popover-empty">None</p>
                  )}
                </section>
                {sectionIndex < 2 ? <div className="voting-popover-divider" aria-hidden="true" /> : null}
              </div>
            ))}

            {votingRecordFooter ? <footer className="voting-popover-footer">{votingRecordFooter}</footer> : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={`project-sidebar-host${sidebarWidthExpanded ? " project-sidebar-host--expanded" : ""}`}
      >
        <aside
          ref={sidebarRef}
          className={`project-details-panel project-sidebar-panel${sidebarWidthExpanded ? " project-sidebar-panel--expanded" : ""}`}
          aria-label="Project details"
        >
        <div
          className={`project-sidebar-inner${
            sidebarWidthExpanded ? " project-sidebar-inner--saas-expanded" : ""
          }${
            detail && timelineViewOpen && verticalTimelineItems.length > 0
              ? " project-sidebar-inner--timeline-expanded"
              : ""
          }`}
        >
          {sidebarWidthExpanded ? (
            detail ? (
              <ExpandedProjectDetailLayout
                detail={detail}
                title={title}
                category={category}
                categoryAccent={categoryAccent}
                overviewSummary={overviewSummary}
                externalUrl={externalUrl}
                status={status}
                voteRows={voteRows}
                voteTally={voteTally}
                primaryMoverId={primaryMoverId}
                votingRecordFooter={votingRecordFooter}
                horizontalMilestones={horizontalMilestones}
                onCollapse={() => setSidebarWidthExpanded(false)}
                onExploreMap={onExploreMap}
              />
            ) : (
              <div className="project-expanded-root project-expanded-root--loading">
                <button
                  type="button"
                  className="project-expanded-collapse-fab"
                  aria-label="Collapse project panel"
                  onClick={() => setSidebarWidthExpanded(false)}
                >
                  <SidebarCollapseIcon width={18} height={18} />
                </button>
                <p className="project-expanded-loading-msg">
                  {isLoading ? "Loading backend project data…" : errorMessage ?? "Project data is not available yet."}
                </p>
              </div>
            )
          ) : (
            <div className="project-sidebar-figma-surface">
              <div
                className="project-sidebar-category-bar"
                style={{ backgroundColor: categoryAccent }}
                aria-hidden="true"
              />

              <div className="project-sidebar-figma-scroll">
                <header className="project-sidebar-header">
                  <div className="project-sidebar-title-band">
                    <h2 className="project-sidebar-title">{title}</h2>
                    <div className="project-sidebar-status-column">
                      <StatusBadge status={status} project={detail?.project ?? null} />
                      <div className="project-sidebar-tool-row">
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
                        ) : (
                          <button
                            type="button"
                            className="project-sidebar-tool-btn project-sidebar-tool-btn--32"
                            disabled
                            aria-label="No external document link available for this project"
                            aria-disabled="true"
                          >
                            <ExternalLinkIcon width={18} height={18} />
                          </button>
                        )}
                        {detail && horizontalMilestones.length > 0 ? (
                          <button
                            type="button"
                            className={`project-sidebar-tool-btn project-sidebar-tool-btn--32 ${timelineViewOpen ? "is-active" : ""}`}
                            aria-label="Timeline view"
                            aria-expanded={timelineViewOpen}
                            aria-controls="project-vertical-timeline-panel"
                            onClick={() => {
                              setIsVotingPopoverOpen(false);
                              setTimelineViewOpen((v) => !v);
                            }}
                          >
                            <ChartLineIcon width={18} height={18} />
                          </button>
                        ) : null}
                        <button
                          ref={voteButtonRef}
                          type="button"
                          className={`project-sidebar-tool-btn project-sidebar-tool-btn--32 ${isVotingPopoverOpen ? "is-active" : ""}`}
                          aria-label="Toggle voting record"
                          aria-expanded={isVotingPopoverOpen}
                          disabled={!detail}
                          onClick={() => {
                            setTimelineViewOpen(false);
                            setIsVotingPopoverOpen((current) => !current);
                          }}
                        >
                          <BallotIcon width={18} height={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="project-sidebar-category">{category}</p>
                </header>

                {detail && timelineViewOpen && verticalTimelineItems.length > 0 ? (
                  <div
                    id="project-vertical-timeline-panel"
                    className="project-sidebar-timeline-expanded"
                    role="region"
                    aria-label="Project timeline"
                  >
                    <VerticalTimelineView items={verticalTimelineItems} />
                  </div>
                ) : (
                  <>
                    {isLoading ? <p className="project-sidebar-status">Loading backend project data…</p> : null}
                    {errorMessage ? (
                      <p className="project-sidebar-status project-sidebar-status--error">{errorMessage}</p>
                    ) : null}

                    <section className="project-sidebar-overview" aria-labelledby="project-overview-heading">
                      <h3 id="project-overview-heading" className="project-sidebar-section-title">
                        Project Overview
                      </h3>
                      {overviewSummary ? <p className="project-sidebar-overview-summary">{overviewSummary}</p> : null}
                      {detail &&
                      (detail.project.district_id != null ||
                        detail.project.meeting_date ||
                        (typeof detail.project.vote_action === "string" && detail.project.vote_action.trim()) ||
                        sidebarHasVoteTallyDisplay(detail)) ? (
                        <dl className="project-sidebar-meta">
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
                      {detail && detail.movers.primary.length > 0 ? (
                        <div className="project-sidebar-movers">
                          <h4 className="project-sidebar-movers-label">Primary Movers:</h4>
                          <p className="project-sidebar-movers-text">
                            {detail.movers.primary.map((m) => formatPersonNameForDisplay(m.name)).join(", ")}
                          </p>
                        </div>
                      ) : null}
                      {detail && detail.movers.secondary.length > 0 ? (
                        <div className="project-sidebar-movers">
                          <h4 className="project-sidebar-movers-label">Secondary Movers:</h4>
                          <p className="project-sidebar-movers-text">
                            {detail.movers.secondary.map((m) => formatPersonNameForDisplay(m.name)).join(", ")}
                          </p>
                        </div>
                      ) : null}
                    </section>

                    {detail && horizontalMilestones.length > 0 ? (
                      <MiniHorizontalTimeline milestones={horizontalMilestones} />
                    ) : null}

                    {detail && detail.timeline.length > 0 && verticalTimelineItems.length === 0 ? (
                      <section className="project-sidebar-timeline-fallback" aria-label="Timeline events">
                        <h3 className="project-sidebar-section-title">Timeline</h3>
                        <ol className="project-timeline project-sidebar-vertical-tl">
                          {detail.timeline.map((entry, index) => (
                            <li key={`${detail.project.id}-timeline-${index}`}>
                              <div className="project-timeline-dot" aria-hidden="true" />
                              <div>
                                <p className="project-timeline-date">{formatProjectDateLong(entry.date)}</p>
                                <p className="project-timeline-text">{entry.text ?? "Activity recorded"}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}
                  </>
                )}
              </div>

              <div className="project-sidebar-footer-cta">
                <button type="button" className="project-sidebar-explore-map" onClick={onExploreMap}>
                  Explore Map
                </button>
              </div>
            </div>
          )}
        </div>
        </aside>
        {!sidebarWidthExpanded ? (
          <div className="project-sidebar-edge-controls">
            <button
              type="button"
              className="project-sidebar-edge-btn project-sidebar-edge-btn--expand"
              aria-label="Expand project panel"
              aria-pressed={false}
              onClick={() => setSidebarWidthExpanded(true)}
            >
              <SidebarExpandIcon width={20} height={20} />
            </button>
            <button
              type="button"
              className="project-sidebar-edge-btn project-sidebar-edge-btn--close"
              aria-label="Close project panel"
              onClick={onExploreMap}
            >
              <CloseIcon width={20} height={20} />
            </button>
          </div>
        ) : null}
      </div>
      {votingRecordDialog}
    </>
  );
}
