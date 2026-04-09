import { ProjectCard, type ProjectCardProps } from "./ProjectCard";

export type RecentProjectListItem = ProjectCardProps & { id: string };

export interface RecentProjectsProps {
  projects: RecentProjectListItem[];
  isLoading: boolean;
  error: string | null;
}

export function RecentProjects({ projects, isLoading, error }: RecentProjectsProps) {
  return (
    <div className="recent-projects-container font-schibsted mx-auto w-[90%] max-w-[1100px] pb-6">
      <h2 className="recent-projects-heading mb-5 text-2xl font-normal text-gray-900">Recent Projects</h2>

      {isLoading ? <p className="status-message font-normal">Loading district projects…</p> : null}
      {error ? <p className="status-message error-message font-normal">{error}</p> : null}

      {!isLoading && !error && projects.length > 0 ? (
        <div className="projects-list flex flex-col gap-5">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              title={project.title}
              titleHref={project.titleHref}
              statusLabel={project.statusLabel}
              statusVariant={project.statusVariant}
              subtitle={project.subtitle}
              description={project.description}
              startDate={project.startDate}
              completedStatus={project.completedStatus}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
