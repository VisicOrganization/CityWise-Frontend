import { useState } from "react";

import { useCouncilMemberBios } from "../../districts/useCouncilMemberBios";

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("");
}

/** Small councilmember headshot, keyed by district_id, with initials fallback. */
export function CouncilMemberAvatar({
  name,
  districtId,
}: {
  name: string;
  districtId: number | null;
}) {
  const { biosByDistrict } = useCouncilMemberBios();
  const [portraitFailed, setPortraitFailed] = useState(false);
  const bio = districtId != null ? biosByDistrict?.get(districtId) : undefined;
  const portraitSrc = bio?.profilePic?.trim() || null;
  const initials = initialsFromName(name);

  return (
    <span className="project-mover-avatar" aria-hidden="true">
      {portraitSrc && !portraitFailed ? (
        <img
          src={portraitSrc}
          alt=""
          className="project-mover-avatar-img"
          onError={() => setPortraitFailed(true)}
        />
      ) : (
        <span className="project-mover-avatar-initials">{initials}</span>
      )}
    </span>
  );
}
