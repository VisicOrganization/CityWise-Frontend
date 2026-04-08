import { useDistrictProfile } from "./useDistrictProfile";
import { useDistrictProjects } from "./useDistrictProjects";


const PAGE_SIZE = 3;

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCompletion(status: string, lastChangedDate: string | null): string {
  if (status === "completed" && lastChangedDate) {
    return formatDate(lastChangedDate);
  }

  return "In progress";
}

interface DistrictOverviewSheetProps {
  districtId: number;
}

export function DistrictOverviewSheet({ districtId }: DistrictOverviewSheetProps) {
  const { profile, error: profileError, isLoading: profileLoading } = useDistrictProfile(districtId);
  const { response, error, isLoading } = useDistrictProjects(districtId, 1, PAGE_SIZE);

  const representative = profile?.name ?? `District ${districtId}`;
  const title = `District ${districtId}`;

  return (
    <section
      className="district-bottom-sheet"
      aria-label="District overview"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="district-sheet-handle" aria-hidden="true" />

      <section className="district-profile-panel">
        <div className="district-portrait" aria-hidden="true">
          <span>{representative.split(" ").map((part) => part[0]).join("")}</span>
        </div>

        <div className="district-profile-copy">
          <h1>
            {representative} • {title}
          </h1>

          {profileLoading ? <p className="status-message">Loading profile…</p> : null}
          {profileError ? <p className="status-message error-message">{profileError}</p> : null}

          <dl className="district-contact-grid">
            {profile?.website ? (
              <div>
                <dt>Website</dt>
                <dd>
                  <a href={profile.website} target="_blank" rel="noreferrer">
                    {profile.website}
                  </a>
                </dd>
              </div>
            ) : null}
            {profile?.phone_number ? (
              <div>
                <dt>Phone</dt>
                <dd>{profile.phone_number}</dd>
              </div>
            ) : null}
          </dl>

          {profile?.about ? (
            <div className="district-about-block">
              <h2>About</h2>
              <p>{profile.about}</p>
            </div>
          ) : null}
        </div>
      </section>

      {profile?.impact_summary ? (
        <section className="district-impact-panel">
          <p className="district-section-label">Impact Summary</p>
          <p className="district-impact-summary-text">{profile.impact_summary}</p>
        </section>
      ) : null}

      <section className="district-recent-panel">
        <div className="district-recent-header">
          <div>
            <p className="district-section-label">Recent Projects</p>
            <h2>Project activity in this district</h2>
          </div>
          {response ? (
            <p className="result-meta">
              Showing {response.items.length} of {response.total} projects
            </p>
          ) : null}
        </div>

        {isLoading ? <p className="status-message">Loading district projects…</p> : null}
        {error ? <p className="status-message error-message">{error}</p> : null}

        {!isLoading && !error && response ? (
          <div className="district-recent-list">
            {response.items.map((project) => (
              <article key={project.id} className="district-recent-card">
                <div className="district-recent-topline">
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.summary}</p>
                  </div>
                  <span className="status-pill">{project.status}</span>
                </div>

                <dl className="district-project-facts district-project-facts-two">
                  <div>
                    <dt>Started</dt>
                    <dd>{formatDate(project.start_date)}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{formatCompletion(project.status, project.last_changed_date)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
