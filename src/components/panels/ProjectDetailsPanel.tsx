import type { ProjectDetail } from "../../lib/contracts";
import type { DemoMapMarker } from "../../lib/mock/mapDemo";


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

interface ProjectDetailsPanelProps {
  marker: DemoMapMarker | null;
  detail: ProjectDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

export function ProjectDetailsPanel({
  marker,
  detail,
  isLoading,
  errorMessage,
  onClose,
}: ProjectDetailsPanelProps) {
  const title = detail?.project.title ?? marker?.label ?? "Project details";
  const status = detail?.project.status ?? "loading";

  return (
    <aside className="project-details-panel" aria-label="Project details">
      <div className="project-details-header">
        <div>
          <p className="project-details-eyebrow">Live backend project snapshot</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="project-details-close" aria-label="Close project details" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="project-details-subhead">
        {marker ? <span className="details-chip">{marker.label}</span> : null}
        <span className="details-chip details-chip-muted">{status}</span>
      </div>

      {isLoading ? (
        <p className="details-status-message">Loading backend project data…</p>
      ) : null}

      {errorMessage ? (
        <p className="details-status-message details-status-error">{errorMessage}</p>
      ) : null}

      {detail ? (
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

            <p className="project-details-summary">{detail.project.summary}</p>
          </section>

          <section className="project-details-section">
            <div className="project-details-section-header">
              <h3>Voting record</h3>
              <span>{detail.votes.length} entries</span>
            </div>
            {detail.votes.length > 0 ? (
              <ul className="project-details-list">
                {detail.votes.slice(0, 6).map((vote) => (
                  <li key={`${detail.project.id}-${vote.member?.id ?? vote.vote}`}>
                    <span>{vote.member?.name ?? "Unknown member"}</span>
                    <strong>{vote.vote ?? "No vote"}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="details-status-message">No recorded votes yet.</p>
            )}
          </section>

          <section className="project-details-section">
            <div className="project-details-section-header">
              <h3>Timeline</h3>
              <span>{detail.timeline.length} events</span>
            </div>
            {detail.timeline.length > 0 ? (
              <ol className="project-timeline">
                {detail.timeline.slice(0, 5).map((entry, index) => (
                  <li key={`${detail.project.id}-timeline-${index}`}>
                    <div className="project-timeline-dot" aria-hidden="true" />
                    <div>
                      <p className="project-timeline-date">{formatPanelDate(entry.date)}</p>
                      <p className="project-timeline-text">{entry.text ?? "Activity recorded"}</p>
                      {entry.documents[0]?.title ? (
                        <p className="project-timeline-doc">Document: {entry.documents[0].title}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="details-status-message">No timeline activity is available.</p>
            )}
          </section>
        </>
      ) : null}
    </aside>
  );
}
