import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";

import type { ProjectDetail } from "../../shared/api/contracts";
import { formatName } from "../../shared/formatPersonName";
import { formatProjectTitleForDisplay } from "../../shared/formatProjectTitleForDisplay";
import type { MapMarker } from "../../shared/map/mapTypes";
import { CloseIcon, ExternalLinkIcon } from "../../shared/ui/visicIcons";
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
import { useMobileProjectSidebarLayout } from "./useMobileProjectSidebarLayout";

/** Public-folder SVGs (Vite: use URL string, not import from `/images`). */
const SIDEBAR_TIMELINE_ICON_SRC = "/images/timeline-icon.svg";
const SIDEBAR_VOTING_ICON_SRC = "/images/voting-icon.svg";
const SIDEBAR_EXPAND_ICON_SRC = "/expand-icon.svg";
const SIDEBAR_COLLAPSE_ICON_SRC = "/collapse-icon.svg";

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
  const topicParts = detail?.address_info?.topics
    ?.map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);
  if (topicParts && topicParts.length > 0) {
    const unique = Array.from(new Set(topicParts));
    return unique.slice(0, 2).join(" & ");
  }

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

function VotingRecordPopoverContent({
  voteTally,
  voteRows,
  primaryMoverId,
  votingRecordFooter,
  onClose,
}: {
  voteTally: { yes: number; no: number; absent: number };
  voteRows: { Yes: VoteRow[]; No: VoteRow[]; Absent: VoteRow[] };
  primaryMoverId: number | null;
  votingRecordFooter: string | null;
  onClose: () => void;
}) {
  return (
    <>
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
        <button type="button" className="voting-popover-close" aria-label="Close voting record" onClick={onClose}>
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
                        highlightYes ? "voting-popover-name voting-popover-name--highlight" : "voting-popover-name"
                      }
                    >
                      <span className="voting-popover-name-text">{formatName(row.name)}</span>
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
    </>
  );
}

export function ProjectDetailsPanel({
  marker,
  detail,
  isLoading,
  errorMessage,
  onExploreMap,
}: ProjectDetailsPanelProps) {
  const posthog = usePostHog();
  const MOBILE_SIDEBAR_CLOSE_ANIMATION_MS = 620;
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
  const [mobileSidebarClosing, setMobileSidebarClosing] = useState(false);
  const isMobileLayout = useMobileProjectSidebarLayout();

  useEffect(() => {
    setTimelineViewOpen(false);
    setSidebarWidthExpanded(false);
  }, [detail?.project.id]);

  useEffect(() => {
    if (isMobileLayout) {
      setSidebarWidthExpanded(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (sidebarWidthExpanded) {
      setIsVotingPopoverOpen(false);
      setTimelineViewOpen(false);
    }
  }, [sidebarWidthExpanded]);

  useEffect(() => {
    if (!isMobileLayout && mobileSidebarClosing) {
      setMobileSidebarClosing(false);
    }
  }, [isMobileLayout, mobileSidebarClosing]);

  const handleCloseProjectSidebar = useCallback(() => {
    if (!isMobileLayout || mobileSidebarClosing) {
      onExploreMap();
      return;
    }
    setMobileSidebarClosing(true);
    window.setTimeout(() => {
      onExploreMap();
    }, MOBILE_SIDEBAR_CLOSE_ANIMATION_MS);
  }, [isMobileLayout, mobileSidebarClosing, onExploreMap]);

  const rawTitle = detail?.project.title ?? marker?.label ?? "Project details";
  const title = useMemo(() => formatProjectTitleForDisplay(rawTitle), [rawTitle]);
  const summary = detail?.project.summary ?? marker?.summary ?? "";
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
    if (!isVotingPopoverOpen || !detail || isMobileLayout) {
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
  }, [isVotingPopoverOpen, detail, sidebarWidthExpanded, isMobileLayout]);

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

  const externalUrl = detail?.project.url ?? null;
  const category = categoryLine(marker, detail);
  const categoryAccent = useMemo(() => categoryAccentBarColor(marker), [marker]);

  const votingRecordPortal =
    !isMobileLayout && isVotingPopoverOpen && detail && votePopoverPlacement
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
            <VotingRecordPopoverContent
              voteTally={voteTally}
              voteRows={voteRows}
              primaryMoverId={primaryMoverId}
              votingRecordFooter={votingRecordFooter}
              onClose={() => setIsVotingPopoverOpen(false)}
            />
          </div>,
          document.body,
        )
      : null;

  const showTimelinePanel = Boolean(detail && timelineViewOpen && verticalTimelineItems.length > 0);
  const showInlineVotingModal = Boolean(isMobileLayout && isVotingPopoverOpen && detail);
  const sidebarAuxExpanded = Boolean(showTimelinePanel);

  return (
    <>
      <div
        className={`project-sidebar-host${sidebarWidthExpanded ? " project-sidebar-host--expanded" : ""}${
          isMobileLayout && !sidebarWidthExpanded ? " project-sidebar-host--mobile-enter" : ""
        }${mobileSidebarClosing ? " project-sidebar-host--mobile-closing" : ""}`}
      >
        <aside
          ref={sidebarRef}
          className={`project-details-panel project-sidebar-panel${sidebarWidthExpanded ? " project-sidebar-panel--expanded" : ""}`}
          aria-label="Project details"
        >
        <div
          className={`project-sidebar-inner${
            sidebarWidthExpanded ? " project-sidebar-inner--saas-expanded" : ""
          }${sidebarAuxExpanded ? " project-sidebar-inner--timeline-expanded" : ""}`}
        >
          {sidebarWidthExpanded ? (
            detail ? (
              <ExpandedProjectDetailLayout
                detail={detail}
                title={title}
                category={category}
                summary={summary}
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
                  <img
                    className="project-sidebar-edge-icon-img"
                    src={SIDEBAR_COLLAPSE_ICON_SRC}
                    alt=""
                    width={18}
                    height={18}
                    decoding="async"
                  />
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

              <div className="project-sidebar-figma-main">
                {isMobileLayout ? (
                  <button
                    type="button"
                    className="project-sidebar-mobile-close"
                    aria-label="Close project overview"
                    onClick={handleCloseProjectSidebar}
                  >
                    <CloseIcon width={16} height={16} />
                  </button>
                ) : null}
                <div className="project-sidebar-figma-scroll">
                <header className="project-sidebar-header">
                  <div className="project-sidebar-title-band">
                    <div className="project-sidebar-title-cluster">
                      <h2 className="project-sidebar-title">
                        {externalUrl ? (
                          <span className="cw-hover-tooltip-anchor">
                            <a
                              className="project-title-link"
                              href={externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => posthog?.capture("project_external_link_clicked", {
                                project_id: detail?.project.id,
                                project_title: title,
                                url: externalUrl,
                              })}
                            >
                              {title}
                            </a>
                            <span className="cw-hover-tooltip-bubble" role="tooltip">
                              Click to view original council file
                            </span>
                          </span>
                        ) : (
                          title
                        )}
                        {externalUrl ? (
                          <>
                            {" "}
                            <a
                              className="project-title-external-link"
                              href={externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open primary project document in a new tab"
                              onClick={() => posthog?.capture("project_external_link_clicked", {
                                project_id: detail?.project.id,
                                project_title: title,
                                url: externalUrl,
                              })}
                            >
                              <ExternalLinkIcon width={16} height={16} />
                            </a>
                          </>
                        ) : null}
                      </h2>
                    </div>
                    <div className="project-sidebar-status-column">
                      <StatusBadge status={status} project={detail?.project ?? null} />
                      <div className="project-sidebar-tool-row">
                        {detail && horizontalMilestones.length > 0 ? (
                          <span className="project-sidebar-tool-btn-with-hint">
                            <button
                              type="button"
                              className={`project-sidebar-tool-btn project-sidebar-tool-btn--32 ${timelineViewOpen ? "is-active" : ""}`}
                              aria-label="Timeline view"
                              aria-expanded={timelineViewOpen}
                              aria-controls="project-vertical-timeline-panel"
                              onClick={() => {
                                setIsVotingPopoverOpen(false);
                                setTimelineViewOpen((v) => {
                                  if (!v) {
                                    posthog?.capture("timeline_view_opened", {
                                      project_id: detail?.project.id,
                                      project_title: title,
                                    });
                                  }
                                  return !v;
                                });
                              }}
                            >
                              <img
                                className="project-sidebar-header-icon-img"
                                src={SIDEBAR_TIMELINE_ICON_SRC}
                                alt=""
                                width={18}
                                height={18}
                                decoding="async"
                              />
                            </button>
                            <span className="project-sidebar-tool-btn-hint" aria-hidden="true">
                              Timeline View
                            </span>
                          </span>
                        ) : null}
                        <span className="project-sidebar-tool-btn-with-hint">
                          <button
                            ref={voteButtonRef}
                            type="button"
                            className={`project-sidebar-tool-btn project-sidebar-tool-btn--32 ${isVotingPopoverOpen ? "is-active" : ""}`}
                            aria-label="Toggle voting record"
                            aria-expanded={isVotingPopoverOpen}
                            disabled={!detail}
                            onClick={() => {
                              setTimelineViewOpen(false);
                              setIsVotingPopoverOpen((current) => {
                                if (!current) {
                                  posthog?.capture("voting_record_opened", {
                                    project_id: detail?.project.id,
                                    project_title: title,
                                  });
                                }
                                return !current;
                              });
                            }}
                          >
                            <img
                              className="project-sidebar-header-icon-img"
                              src={SIDEBAR_VOTING_ICON_SRC}
                              alt=""
                              width={18}
                              height={18}
                              decoding="async"
                            />
                          </button>
                          <span className="project-sidebar-tool-btn-hint" aria-hidden="true">
                            Voting Record
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="project-sidebar-category">{category}</p>
                </header>

                {showTimelinePanel ? (
                  <div
                    id="project-vertical-timeline-panel"
                    className="project-sidebar-timeline-expanded"
                    role="region"
                    aria-label="Project timeline"
                  >
                    <VerticalTimelineView
                      items={verticalTimelineItems}
                      onOverviewClick={() => {
                        setTimelineViewOpen(false);
                        setIsVotingPopoverOpen(false);
                      }}
                    />
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
                            {detail.movers.primary.map((m) => formatName(m.name)).join(", ")}
                          </p>
                        </div>
                      ) : null}
                      {detail && detail.movers.secondary.length > 0 ? (
                        <div className="project-sidebar-movers">
                          <h4 className="project-sidebar-movers-label">Secondary Movers:</h4>
                          <p className="project-sidebar-movers-text">
                            {detail.movers.secondary.map((m) => formatName(m.name)).join(", ")}
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
                  <button type="button" className="project-sidebar-explore-map" onClick={handleCloseProjectSidebar}>
                    Explore Map
                  </button>
                </div>
              </div>
              {showInlineVotingModal ? (
                <div
                  className="project-sidebar-voting-modal-backdrop"
                  role="presentation"
                  onClick={() => setIsVotingPopoverOpen(false)}
                >
                  <div
                    className="project-sidebar-voting-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Voting record"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <VotingRecordPopoverContent
                      voteTally={voteTally}
                      voteRows={voteRows}
                      primaryMoverId={primaryMoverId}
                      votingRecordFooter={votingRecordFooter}
                      onClose={() => setIsVotingPopoverOpen(false)}
                    />
                  </div>
                </div>
              ) : null}
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
              onClick={() => {
                posthog?.capture("project_panel_expanded", {
                  project_id: detail?.project.id,
                  project_title: title,
                });
                setSidebarWidthExpanded(true);
              }}
            >
              <img
                className="project-sidebar-edge-icon-img"
                src={SIDEBAR_EXPAND_ICON_SRC}
                alt=""
                width={18}
                height={18}
                decoding="async"
              />
            </button>
            <button
              type="button"
              className="project-sidebar-edge-btn project-sidebar-edge-btn--close"
              aria-label="Close project panel"
              onClick={handleCloseProjectSidebar}
            >
              <img
                className="project-sidebar-edge-icon-img"
                src={SIDEBAR_COLLAPSE_ICON_SRC}
                alt=""
                width={18}
                height={18}
                decoding="async"
              />
            </button>
          </div>
        ) : null}
      </div>
      {votingRecordPortal}
    </>
  );
}
