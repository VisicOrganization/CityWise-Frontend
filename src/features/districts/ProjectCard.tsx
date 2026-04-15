import { ExternalLinkIcon } from "../../shared/ui/visicIcons";

export type ProjectStatusVariant = "completed" | "planned" | "in_progress" | "default";

export type ProjectCardLayoutVariant = "default" | "districtOverview";

export interface ProjectCardProps {
  title: string;
  titleHref?: string | null;
  statusLabel: string;
  statusVariant: ProjectStatusVariant;
  subtitle: string;
  description: string;
  startDate: string;
  completedStatus: string;
  className?: string;
  layoutVariant?: ProjectCardLayoutVariant;
  /** District overview: open this project on the map and sidebar */
  onOpenOnMap?: () => void;
  /** District overview: primary http document URL (opens in new tab from link control) */
  externalUrl?: string | null;
}

function statusBadgeClasses(variant: ProjectStatusVariant): string {
  const base =
    "status-badge shrink-0 rounded-full font-normal leading-none district-overview-project-card__badge";
  if (variant === "completed") {
    return `${base} district-overview-project-card__badge--completed`;
  }
  if (variant === "planned") {
    return `${base} district-overview-project-card__badge--planned`;
  }
  if (variant === "in_progress") {
    return `${base} district-overview-project-card__badge--in_progress`;
  }
  return `${base} district-overview-project-card__badge--default`;
}

function statusBadgeClassesDefault(variant: ProjectStatusVariant): string {
  const base = "status-badge shrink-0 px-4 py-1.5 rounded-full text-sm font-normal leading-none";
  if (variant === "completed") {
    return `${base} bg-[#DCF5E4] text-[#1F7A4D]`;
  }
  if (variant === "planned") {
    return `${base} bg-[#FFE8CC] text-[#9A5F00]`;
  }
  if (variant === "in_progress") {
    return `${base} bg-[#FFF4E0] text-[#8B6914]`;
  }
  return `${base} bg-[#E8E8E8] text-[#5A5A5A]`;
}

export function ProjectCard({
  title,
  titleHref,
  statusLabel,
  statusVariant,
  subtitle,
  description,
  startDate,
  completedStatus,
  className = "",
  layoutVariant = "default",
  onOpenOnMap,
  externalUrl = null,
}: ProjectCardProps) {
  if (layoutVariant === "districtOverview") {
    return (
      <article className={`district-overview-project-card ${className}`.trim()}>
        <div className="district-overview-project-card__top">
          <div className="district-overview-project-card__open district-overview-project-card__open--titles">
            {titleHref ? (
              <a
                href={titleHref}
                target="_blank"
                rel="noreferrer noopener"
                className="district-overview-project-card__title district-overview-project-card__title-link"
              >
                {title}
              </a>
            ) : (
              <span className="district-overview-project-card__title">{title}</span>
            )}
            <span className="district-overview-project-card__subtitle">{subtitle}</span>
          </div>
          <div className="district-overview-project-card__top-actions">
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="district-overview-project-card__external-link"
                aria-label="Open project document in new tab"
              >
                <ExternalLinkIcon width={18} height={18} className="district-overview-project-card__external-icon" aria-hidden />
              </a>
            ) : null}
            <span className={statusBadgeClasses(statusVariant)}>{statusLabel}</span>
          </div>
        </div>

        <button
          type="button"
          className="district-overview-project-card__open district-overview-project-card__open--rest"
          onClick={() => onOpenOnMap?.()}
        >
          <p className="district-overview-project-card__description">{description}</p>
          <div className="district-overview-project-card__rule" role="presentation" />
          <div className="district-overview-project-card__meta">
            <div className="district-overview-project-card__meta-row">
              <span className="district-overview-project-card__meta-label">Started:</span>
              <span className="district-overview-project-card__meta-value">{startDate}</span>
            </div>
            <div className="district-overview-project-card__meta-row">
              <span className="district-overview-project-card__meta-label">Completed:</span>
              <span className="district-overview-project-card__meta-value">{completedStatus}</span>
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <article
      className={`project-card w-full rounded-2xl border border-gray-200/80 bg-white p-8 font-schibsted shadow-[0_2px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] ${className}`.trim()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center">
          {titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noreferrer noopener"
              className="project-title min-w-0 text-[22px] font-normal text-black no-underline hover:underline"
            >
              {title}
            </a>
          ) : (
            <h3 className="project-title m-0 min-w-0 text-[22px] font-normal text-black">{title}</h3>
          )}
        </div>
        <span className={statusBadgeClassesDefault(statusVariant)}>{statusLabel}</span>
      </div>

      <p className="project-subtitle mt-2 text-base font-normal text-[#6B6B6B]">{subtitle}</p>

      <div className="divider my-4 border-t border-[#D9D9D9]" role="presentation" />

      <p className="project-description mb-5 text-[15px] font-normal leading-[1.6] text-[#4A4A4A]">
        {description}
      </p>

      <div className="project-details flex flex-col gap-3">
        <div className="detail-row flex items-center justify-between gap-3">
          <span className="detail-label text-[15px] font-normal text-[#6B6B6B]">Started</span>
          <span className="detail-value text-right text-[15px] font-normal text-[#1a1a1a]">{startDate}</span>
        </div>
        <div className="detail-row flex items-center justify-between gap-3">
          <span className="detail-label text-[15px] font-normal text-[#6B6B6B]">Completed</span>
          <span className="detail-value text-right text-[15px] font-normal text-[#1a1a1a]">
            {completedStatus}
          </span>
        </div>
      </div>
    </article>
  );
}
