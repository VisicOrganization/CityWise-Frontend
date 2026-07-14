import { useState } from "react";

import { councilMemberNameKey } from "../../../shared/data/councilMemberBio";
import { useCouncilMemberBios } from "../../districts/useCouncilMemberBios";

const NO_PROFILE_PICTURE_SRC = "/images/no-profile-picture.svg";

/**
 * Small councilmember headshot for a project mover.
 *
 * Identity is the mover's name, never their `district_id`: movers include former members
 * who still carry a district (e.g. Gilbert Cedillo, district 1), so keying on district
 * would show whoever holds that seat today. Only a member on the current roster gets a
 * headshot; everyone else gets the placeholder.
 */
export function CouncilMemberAvatar({ name }: { name: string }) {
  const { biosByName } = useCouncilMemberBios();
  const [portraitFailed, setPortraitFailed] = useState(false);

  const bio = biosByName?.get(councilMemberNameKey(name));
  const portraitSrc = bio?.profilePic?.trim() || null;
  const showPortrait = portraitSrc !== null && !portraitFailed;

  return (
    <span className="project-mover-avatar" aria-hidden="true">
      {showPortrait ? (
        <img
          src={portraitSrc}
          alt=""
          className="project-mover-avatar-img"
          onError={() => setPortraitFailed(true)}
        />
      ) : (
        <img src={NO_PROFILE_PICTURE_SRC} alt="" className="project-mover-avatar-placeholder" />
      )}
    </span>
  );
}
