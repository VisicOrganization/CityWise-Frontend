import { normalizeCouncilWebsiteUrl } from "../../shared/data/councilMemberBio";
import { RecentProjects } from "./RecentProjects";
import { useCouncilMemberBios } from "./useCouncilMemberBios";
import { useDistrictProfile } from "./useDistrictProfile";
import { useDistrictProjects } from "./useDistrictProjects";
// import { HousingIcon, InfrastructureIcon, TransitIcon } from "../../shared/ui/visicIcons";


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

  return "In Progress";
}

function formatStatus(status: string): string {
  return status
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatProjectCategory(topics: string[] | undefined, status: string): string {
  const topic = topics?.find((value) => value.trim().length > 0);
  if (topic) {
    return topic;
  }

  if (status === "planned") {
    return "Transportation";
  }

  return formatStatus(status);
}

function projectStatusVariant(status: string): "completed" | "planned" | "in_progress" | "default" {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "completed") {
    return "completed";
  }
  if (normalized === "planned") {
    return "planned";
  }
  if (normalized.includes("progress") || status.toLowerCase().includes("progress")) {
    return "in_progress";
  }
  return "default";
}

interface DistrictOverviewSheetProps {
  districtId: number;
  onOpenMap: () => void;
}

export function DistrictOverviewSheet({ districtId, onOpenMap }: DistrictOverviewSheetProps) {
  const { profile, error: profileError } = useDistrictProfile(districtId);
  const { biosByDistrict } = useCouncilMemberBios();
  const { response, error, isLoading } = useDistrictProjects(districtId, 1, PAGE_SIZE);

  const bio = biosByDistrict?.get(districtId);
  const representative = bio?.name ?? profile?.name ?? `District ${districtId}`;
  const title = `District ${districtId}`;

  const displayEmail = bio?.email?.trim() ? bio.email.trim() : null;
  const displayPhone = bio?.phoneNumber || profile?.phone_number || null;
  const displayWebsiteHref = bio?.websiteHref ?? normalizeCouncilWebsiteUrl(profile?.website ?? null);
  const displayWebsiteText =
    (bio?.websiteDisplay ? bio.websiteDisplay : null) || profile?.website || displayWebsiteHref;
  const displayAbout = bio?.aboutMe || profile?.about || null;
  const portraitSrc = bio?.profilePic?.trim() || profile?.profile_pic?.trim() || null;
  const initials = representative
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <section
      className="district-bottom-sheet district-bottom-sheet--scroll font-schibsted"
      aria-label="District overview"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="district-sheet-scroll-area">
        <div className="district-sheet-handle" aria-hidden="true" />

        <section className="district-profile-panel">
          <div className="district-portrait" aria-hidden="true">
            {portraitSrc ? (
              <img
                src={portraitSrc}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="district-profile-copy">
            <div className="district-profile-header">
              <h1 className="font-public-sans font-normal">
                {representative} • {title}
              </h1>
            </div>

            <div className="district-profile-body">
              {profileError ? (
                <p className="status-message error-message" role="status">
                  {profileError} Photo and server fields may be missing.
                </p>
              ) : null}

              <dl className="district-contact-grid">
                <div>
                  <dt>Website</dt>
                  <dd>
                    {displayWebsiteHref ? (
                      <a href={displayWebsiteHref} target="_blank" rel="noreferrer">
                        {displayWebsiteText}
                      </a>
                    ) : (
                      "Not available"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{displayPhone ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {displayEmail ? (
                      <a href={`mailto:${displayEmail}`} rel="noreferrer">
                        {displayEmail}
                      </a>
                    ) : (
                      "Not available"
                    )}
                  </dd>
                </div>
              </dl>

              {displayAbout ? (
                <div className="district-about-block">
                  <h2>About</h2>
                  <p>{displayAbout}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="district-recent-panel">
          <RecentProjects
            projects={
              response?.items.map((project) => ({
                id: project.id,
                title: project.title,
                titleHref: null,
                statusLabel: formatStatus(project.status),
                statusVariant: projectStatusVariant(project.status),
                subtitle: formatProjectCategory(project.address_info?.topics, project.status),
                description: project.summary,
                startDate: formatDate(project.start_date),
                completedStatus: formatCompletion(project.status, project.last_changed_date),
              })) ?? []
            }
            isLoading={isLoading}
            error={error}
          />
        </section>
      </div>

      {!isLoading ? (
        <button
          type="button"
          className="district-open-map-fixed font-schibsted"
          onClick={onOpenMap}
        >
          Open Map
        </button>
      ) : null}
    </section>
  );
}
