import { useCallback, useEffect, useRef, useState } from "react";

import { ProjectCard, type ProjectCardLayoutVariant, type ProjectCardProps } from "./ProjectCard";

export type RecentProjectListItem = ProjectCardProps & { id: string };

export interface RecentProjectsProps {
  projects: RecentProjectListItem[];
  isLoading: boolean;
  error: string | null;
  layoutVariant?: ProjectCardLayoutVariant;
}

export function RecentProjects({ projects, isLoading, error, layoutVariant = "default" }: RecentProjectsProps) {
  const isDistrictOverview = layoutVariant === "districtOverview";
  const headingClass = isDistrictOverview
    ? "district-overview-recent-heading"
    : "recent-projects-heading mb-5 text-2xl font-normal text-gray-900";

  const listClass = isDistrictOverview
    ? "projects-list district-overview-projects-list"
    : "projects-list flex flex-col gap-5";
  const subtitleClass = isDistrictOverview
    ? "district-overview-recent-subtitle"
    : "recent-projects-subtitle mb-4 text-sm font-normal text-gray-500";

  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }
    setShowScrollHint(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);

  useEffect(() => {
    updateScrollHint();
  }, [updateScrollHint, projects]);

  useEffect(() => {
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [updateScrollHint]);

  const list = (
    <div className={listClass} ref={listRef} onScroll={isDistrictOverview ? updateScrollHint : undefined}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          layoutVariant={layoutVariant}
          title={project.title}
          titleHref={project.titleHref}
          statusLabel={project.statusLabel}
          statusVariant={project.statusVariant}
          category={project.category}
          subtitle={project.subtitle}
          description={project.description}
          startDate={project.startDate}
          completedStatus={project.completedStatus}
          externalUrl={project.externalUrl}
          onOpenOnMap={project.onOpenOnMap}
        />
      ))}
    </div>
  );

  return (
    <div className="recent-projects-container font-schibsted mx-auto w-[90%] max-w-[1100px] pb-6">
      <h2 className={headingClass}>{isDistrictOverview ? "Mapped Council Files" : "Projects"}</h2>
      <p className={subtitleClass}>Click on a project to learn more.</p>

      {isLoading ? <p className="status-message font-normal">Loading district projects…</p> : null}
      {error ? <p className="status-message error-message font-normal">{error}</p> : null}

      {!isLoading && !error && projects.length > 0 ? (
        isDistrictOverview ? (
          <div className="district-overview-projects-scroll">
            {list}
            {showScrollHint ? (
              <div className="district-overview-scroll-hint" aria-hidden="true">
                Scroll for more ↓
              </div>
            ) : null}
          </div>
        ) : (
          list
        )
      ) : null}
    </div>
  );
}
