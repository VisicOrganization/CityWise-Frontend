import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DistrictMap } from "../components/map/DistrictMap";
import { AppShell } from "../components/shell/AppShell";
import { getDistrictProjects } from "../lib/api";
import type { DistrictProjectsResponse } from "../lib/contracts";
import { getDeterministicProjectBudget, getDistrictContent } from "../lib/districtContent";


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

function formatBudget(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatCompletion(status: string, lastChangedDate: string | null): string {
  if (status === "completed" && lastChangedDate) {
    return formatDate(lastChangedDate);
  }

  return "In progress";
}

export function DistrictOverviewPage() {
  const params = useParams<{ districtId: string }>();
  const districtId = Number(params.districtId);
  const districtContent = getDistrictContent(districtId);

  const [response, setResponse] = useState<DistrictProjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    getDistrictProjects(districtId, 1, PAGE_SIZE)
      .then((nextResponse) => {
        if (!ignore) {
          setResponse(nextResponse);
        }
      })
      .catch((nextError: Error) => {
        if (!ignore) {
          setError(nextError.message);
          setResponse(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [districtId]);

  return (
    <AppShell className="district-page-shell">
      <main className="district-overview-page">
        <section className="district-profile-panel">
          <div className="district-portrait" aria-hidden="true">
            <span>{districtContent.representative.split(" ").map((part) => part[0]).join("")}</span>
          </div>

          <div className="district-profile-copy">
            <h1>
              {districtContent.representative} • {districtContent.title}
            </h1>

            <dl className="district-contact-grid">
              <div>
                <dt>Website</dt>
                <dd>
                  <a href={districtContent.website} target="_blank" rel="noreferrer">
                    {districtContent.website}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{districtContent.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{districtContent.email}</dd>
              </div>
            </dl>

            <div className="district-about-block">
              <h2>About</h2>
              <p>{districtContent.about}</p>
            </div>
          </div>
        </section>

        <section className="district-impact-panel">
          <p className="district-section-label">Impact Summary</p>
          <div className="district-impact-grid">
            {districtContent.impactSummary.map((item) => (
              <article key={item.id} className="district-impact-card">
                <h3>{item.label}</h3>
                <strong>{item.stat}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="district-recent-panel">
          <div className="district-recent-header">
            <div>
              <p className="district-section-label">Recent Projects</p>
              <h2>{districtContent.summary}</h2>
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

                  <dl className="district-project-facts">
                    <div>
                      <dt>Budget</dt>
                      <dd>{formatBudget(getDeterministicProjectBudget(districtId, project.id))}</dd>
                    </div>
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

          <div className="district-overview-footer">
            <Link className="district-open-map" to="/map">
              Open Map
            </Link>
          </div>
        </section>

        <section className="district-map-panel">
          <DistrictMap activeDistrictId={districtId} />
        </section>
      </main>
    </AppShell>
  );
}
