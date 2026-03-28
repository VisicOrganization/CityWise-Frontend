import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { DistrictMap } from "../components/map/DistrictMap";
import { getDistrictProjects } from "../lib/api";
import type { DistrictProjectsResponse } from "../lib/contracts";
import { getDistrictContent } from "../lib/districtContent";


const PAGE_SIZE = 3;


function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


export function DistrictOverviewPage() {
  const params = useParams<{ districtId: string }>();
  const districtId = Number(params.districtId);
  const districtContent = getDistrictContent(districtId);

  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<DistrictProjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [districtId]);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError(null);

    getDistrictProjects(districtId, page, PAGE_SIZE)
      .then((nextResponse) => {
        if (ignore) {
          return;
        }
        setResponse(nextResponse);
      })
      .catch((nextError: Error) => {
        if (ignore) {
          return;
        }
        setError(nextError.message);
        setResponse(null);
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [districtId, page]);

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">CityWise MVP</p>
          <h1>{districtContent.title} projects</h1>
          <p className="lede">{districtContent.summary}</p>
          <p className="supporting-copy">{districtContent.about}</p>
          <dl className="district-meta">
            <div>
              <dt>Representative</dt>
              <dd>{districtContent.representative}</dd>
            </div>
            <div>
              <dt>Pagination</dt>
              <dd>Fixed backend ordering, 3 projects per page</dd>
            </div>
          </dl>
        </div>
        <DistrictMap activeDistrictId={districtId} />
      </section>

      <section className="projects-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">District overview</p>
            <h2>Projects</h2>
          </div>
          {response ? (
            <p className="result-meta">
              Page {response.page} of {Math.max(response.total_pages, 1)} · {response.total} total projects
            </p>
          ) : null}
        </div>

        {isLoading ? <p className="status-message">Loading district projects…</p> : null}
        {error ? <p className="status-message error-message">{error}</p> : null}

        {!isLoading && !error && response ? (
          <>
            <div className="project-grid">
              {response.items.map((project) => (
                <article key={project.id} className="project-card">
                  <div className="card-topline">
                    <span className="status-pill">{project.status}</span>
                    <span className="project-id">{project.id}</span>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <dl className="project-meta">
                    <div>
                      <dt>Last updated</dt>
                      <dd>{formatDate(project.last_changed_date)}</dd>
                    </div>
                    <div>
                      <dt>Introduced</dt>
                      <dd>{formatDate(project.start_date)}</dd>
                    </div>
                    <div>
                      <dt>Documents</dt>
                      <dd>{project.document_count}</dd>
                    </div>
                  </dl>
                  <div className="mover-row">
                    <strong>Primary movers</strong>
                    <span>{project.primary_movers.join(", ") || "Not available"}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="pagination-row">
              <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1}>
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= response.total_pages}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
