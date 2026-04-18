import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import { normalizeCouncilWebsiteUrl } from "../../shared/data/councilMemberBio";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { formatProjectTitleForDisplay } from "../../shared/formatProjectTitleForDisplay";
import { RecentProjects } from "./RecentProjects";
import { useCouncilMemberBios } from "./useCouncilMemberBios";
import { useDistrictProfile } from "./useDistrictProfile";
import { useDistrictProjects } from "./useDistrictProjects";
// import { HousingIcon, InfrastructureIcon, TransitIcon } from "../../shared/ui/visicIcons";

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
  isClosing?: boolean;
  onOpenMap: () => void;
  /** Shown in the top pill (e.g. searched address); falls back to “District {id}”. */
  focusLabel?: string | null;
  /** Select marker + open project sidebar (same as tapping the map pin). */
  onSelectProjectOnMap: (projectId: string) => void;
}

function DistrictAboutSection({ text, districtId }: { text: string; districtId: number }) {
  const posthog = usePostHog();
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setIsTruncatable(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = paragraphRef.current;
    if (!el || expanded) {
      return;
    }

    const measure = () => {
      setIsTruncatable((prev) => prev || el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="district-about-block">
      <h2 className="district-about-heading">About</h2>
      <p
        ref={paragraphRef}
        className={
          expanded ? "district-about-body" : "district-about-body district-about-body--collapsed"
        }
      >
        {text}
      </p>
      {isTruncatable ? (
        <button
          type="button"
          className="district-about-toggle font-schibsted"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((v) => {
              if (!v) {
                posthog?.capture("district_about_expanded", { district_id: districtId });
              }
              return !v;
            });
          }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

export function DistrictOverviewSheet({
  districtId,
  isClosing = false,
  onOpenMap,
  focusLabel = null,
  onSelectProjectOnMap,
}: DistrictOverviewSheetProps) {
  const posthog = usePostHog();
  const { profile, error: profileError } = useDistrictProfile(districtId);
  const { biosByDistrict } = useCouncilMemberBios();
  const { response, error, isLoading } = useDistrictProjects(districtId, 1, 100, { fetchAllPages: true });

  const bio = biosByDistrict?.get(districtId);
  const representativeRaw = (bio?.name?.trim() || profile?.name?.trim() || "") || "";
  const representative = representativeRaw
    ? formatPersonNameForDisplay(representativeRaw)
    : `District ${districtId}`;
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
    .filter(Boolean)
    .join("");

  const topPillText = (focusLabel?.trim() || `District ${districtId}`).trim();

  return (
    <div className={`district-sheet-dock${isClosing ? " is-closing" : ""}`}>
      <div className="district-sheet-top-pill-shell">
        <button
          type="button"
          className="district-sheet-top-pill font-schibsted"
          aria-label="Return to map from district overview"
          onClick={onOpenMap}
        >
          <span className="district-sheet-top-pill-text">{topPillText}</span>
        </button>
      </div>
      <section
        className="district-bottom-sheet district-bottom-sheet--scroll font-schibsted"
        aria-label={isClosing ? "District overview closing" : "District overview"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="district-sheet-scroll-area">
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
                <h1 className="font-public-sans district-council-name-line">
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
                    <dd className="district-contact-value-web">
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
                    <dd className="district-contact-value-web">{displayPhone ?? "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd className="district-contact-value-email">
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

                {displayAbout ? <DistrictAboutSection text={displayAbout} districtId={districtId} /> : null}
              </div>
            </div>
          </section>

          <section className="district-recent-panel">
            <RecentProjects
              layoutVariant="districtOverview"
              projects={
                response?.items.map((project) => ({
                  id: project.id,
                  title: formatProjectTitleForDisplay(project.title),
                  titleHref: project.url ?? null,
                  statusLabel: formatStatus(project.status),
                  statusVariant: projectStatusVariant(project.status),
                  subtitle: formatProjectCategory(project.address_info?.topics, project.status),
                  description: project.summary,
                  startDate: formatDate(project.start_date),
                  completedStatus: formatCompletion(project.status, project.last_changed_date),
                  externalUrl: project.url ?? null,
                  onOpenOnMap: () => {
                    posthog?.capture("project_opened_from_district", {
                      project_id: project.id,
                      project_title: project.title,
                      district_id: districtId,
                    });
                    onSelectProjectOnMap(project.id);
                  },
                })) ?? []
              }
              isLoading={isLoading}
              error={error}
            />
          </section>
        </div>

        <button
          type="button"
          className="district-open-map-fixed font-schibsted"
          onClick={onOpenMap}
          disabled={isLoading}
          aria-disabled={isLoading}
        >
          Open Map
        </button>
      </section>
    </div>
  );
}
