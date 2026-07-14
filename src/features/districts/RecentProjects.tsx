import { ProjectCard, type ProjectCardLayoutVariant, type ProjectCardProps } from "./ProjectCard";

export type RecentProjectListItem = ProjectCardProps & { id: string };

export interface RecentProjectsProps {
  projects: RecentProjectListItem[];
  isLoading: boolean;
  error: string | null;
  layoutVariant?: ProjectCardLayoutVariant;
}

export function RecentProjects({ projects, isLoading, error, layoutVariant = "default" }: RecentProjectsProps) {
  const headingClass =
    layoutVariant === "districtOverview"
      ? "district-overview-recent-heading"
      : "recent-projects-heading mb-5 text-2xl font-normal text-gray-900";

  const listClass =
    layoutVariant === "districtOverview" ? "projects-list district-overview-projects-list" : "projects-list flex flex-col gap-5";
  const subtitleClass =
    layoutVariant === "districtOverview"
      ? "district-overview-recent-subtitle"
      : "recent-projects-subtitle mb-4 text-sm font-normal text-gray-500";

  return (
    <div className="recent-projects-container font-schibsted mx-auto w-[90%] max-w-[1100px] pb-6">
      <h2 className={headingClass}>Projects</h2>
      <p className={subtitleClass}>
        Click on a project to learn more.
      </p>

      {isLoading ? <p className="status-message font-normal">Loading district projects…</p> : null}
      {error ? <p className="status-message error-message font-normal">{error}</p> : null}

      {!isLoading && !error && projects.length > 0 ? (
        <div className={listClass}>
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
      ) : null}
    </div>
  );
}
