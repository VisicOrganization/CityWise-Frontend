import { useMemo, useState } from "react";

import type { ProjectDetail } from "../../shared/api/contracts";
import type { MapMarker } from "../../shared/map/mapTypes";
import { BallotIcon, HousingIcon, InfrastructureIcon, TimelineIcon, TransitIcon } from "../../shared/ui/visicIcons";


function formatPanelDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeVoteGroup(vote: string | null) {
  const normalized = vote?.trim().toLowerCase();

  if (normalized === "yes" || normalized === "aye") {
    return "Yes";
  }

  if (normalized === "no" || normalized === "nay") {
    return "No";
  }

  return "Absent";
}

function ProjectCategoryIcon({ marker }: { marker: MapMarker | null }) {
  const props = { width: 28, height: 28, className: "project-category-icon" };

  if (marker?.category === "housing") {
    return <HousingIcon {...props} />;
  }

  if (marker?.category === "transit") {
    return <TransitIcon {...props} />;
  }

  return <InfrastructureIcon {...props} />;
}

interface ProjectDetailsPanelProps {
  marker: MapMarker | null;
  detail: ProjectDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
}


export function ProjectDetailsPanel({
  marker,
  detail,
  isLoading,
  errorMessage,
}: ProjectDetailsPanelProps) {
  const [activeView, setActiveView] = useState<"overview" | "timeline">("overview");
  const [isVotingPopoverOpen, setIsVotingPopoverOpen] = useState(false);
  const title = detail?.project.title ?? marker?.label ?? "Project details";
  const status = detail?.project.status ?? "loading";
  const voteGroups = useMemo(() => {
    const groups = {
      Yes: [] as string[],
      No: [] as string[],
      Absent: [] as string[],
    };

    detail?.votes.forEach((vote) => {
      groups[normalizeVoteGroup(vote.vote)].push(vote.member?.name ?? "Unknown member");
    });

    return groups;
  }, [detail]);

  return (
    <aside className="project-details-panel" aria-label="Project details">
      <div className="project-details-hero">
        <div className="project-details-hero-copy">
          <div className="project-details-kicker">
            <ProjectCategoryIcon marker={marker} />
            <span>{marker?.label ?? "City project"}</span>
          </div>
          <div className="project-details-header">
            <div>
              <h2>{title}</h2>
              <p className="project-details-summary">
                {detail?.project.summary || detail?.project.about || "Project summary content will be expanded as more source detail lands in the MVP."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="project-details-subhead">
        {marker ? <span className="details-chip">{marker.label}</span> : null}
        <span className="details-chip details-chip-muted">{status}</span>
      </div>

      <div className="project-details-toolbar">
        <div className="details-toggle-group" role="tablist" aria-label="Project detail views">
          <button
            type="button"
            className={activeView === "overview" ? "is-active" : ""}
            role="tab"
            aria-selected={activeView === "overview"}
            onClick={() => setActiveView("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={activeView === "timeline" ? "is-active" : ""}
            role="tab"
            aria-selected={activeView === "timeline"}
            onClick={() => setActiveView("timeline")}
          >
            <TimelineIcon width={16} height={16} />
            Timeline
          </button>
        </div>

        <div className="project-details-ballot-shell">
          <button
            type="button"
            className={`details-icon-button ${isVotingPopoverOpen ? "is-active" : ""}`}
            aria-label="Toggle voting record"
            aria-expanded={isVotingPopoverOpen}
            onClick={() => setIsVotingPopoverOpen((current) => !current)}
          >
            <BallotIcon width={18} height={18} />
          </button>
          {isVotingPopoverOpen && detail ? (
            <div className="voting-popover" aria-label="Voting record popover">
              <div className="voting-popover-header">
                <strong>Voting record</strong>
                <span>{detail.votes.length} entries</span>
              </div>
              {Object.entries(voteGroups).map(([label, names]) => (
                <section key={label} className="voting-popover-group">
                  <h4>{label}</h4>
                  {names.length > 0 ? (
                    <ul>
                      {names.map((name) => (
                        <li key={`${label}-${name}`}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No entries</p>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="details-status-message">Loading backend project data…</p>
      ) : null}

      {errorMessage ? (
        <p className="details-status-message details-status-error">{errorMessage}</p>
      ) : null}

      {detail ? (
        activeView === "overview" ? (
          <>
            <section className="project-details-section">
              <dl className="project-detail-meta-grid">
                <div>
                  <dt>Project ID</dt>
                  <dd>{detail.project.id}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{detail.project.district_id ?? "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Meeting Date</dt>
                  <dd>{formatPanelDate(detail.project.meeting_date)}</dd>
                </div>
                <div>
                  <dt>Vote Action</dt>
                  <dd>{detail.project.vote_action ?? "Pending"}</dd>
                </div>
              </dl>
            </section>

            <section className="project-details-section">
              <div className="project-details-section-header">
                <h3>Project Overview</h3>
                <span>{detail.documents.length} documents</span>
              </div>
              <p className="project-details-summary">
                {detail.project.about ?? detail.project.summary ?? "Project overview copy is still being expanded for the MVP."}
              </p>
              <div className="project-mover-list">
                {detail.movers.primary.length > 0 ? (
                  <div>
                    <dt>Primary movers</dt>
                    <dd>{detail.movers.primary.map((member) => member.name).join(", ")}</dd>
                  </div>
                ) : null}
                {detail.movers.secondary.length > 0 ? (
                  <div>
                    <dt>Secondary movers</dt>
                    <dd>{detail.movers.secondary.map((member) => member.name).join(", ")}</dd>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <section className="project-details-section">
            <div className="project-details-section-header">
              <h3>Timeline</h3>
              <span>{detail.timeline.length} events</span>
            </div>
            {detail.timeline.length > 0 ? (
              <ol className="project-timeline">
                {detail.timeline.map((entry, index) => (
                  <li key={`${detail.project.id}-timeline-${index}`}>
                    <div className="project-timeline-dot" aria-hidden="true" />
                    <div>
                      <p className="project-timeline-date">{formatPanelDate(entry.date)}</p>
                      <p className="project-timeline-text">{entry.text ?? "Activity recorded"}</p>
                      {entry.documents[0]?.title && entry.documents[0]?.url ? (
                        <a
                          className="project-timeline-doc"
                          href={entry.documents[0].url}
                          target="_blank"
                          rel="noreferrer"
                          download
                        >
                          Download document: {entry.documents[0].title}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="details-status-message">No timeline activity is available.</p>
            )}
          </section>
        )
      ) : null}
    </aside>
  );
}
