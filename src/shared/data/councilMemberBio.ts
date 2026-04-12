export interface CouncilMemberBio {
  cd: number;
  name: string;
  email: string;
  phoneNumber: string;
  /** Normalized URL safe for `href` */
  websiteHref: string | null;
  /** Original trimmed website string from JSON (for display) */
  websiteDisplay: string;
  aboutMe: string;
  /** Council member headshot URL from static bios JSON */
  profilePic: string | null;
}

export function normalizeCouncilWebsiteUrl(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCouncilMemberBiosPayload(data: unknown): CouncilMemberBio[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const result: CouncilMemberBio[] = [];

  for (const entry of data) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const cd = row.CD;
    if (typeof cd !== "number" || !Number.isFinite(cd) || cd < 1) {
      continue;
    }

    const name = stringField(row.Name);
    if (!name) {
      continue;
    }

    const websiteRaw = stringField(row["Website Link"]);
    const websiteHref = normalizeCouncilWebsiteUrl(websiteRaw || null);
    const profilePicRaw = stringField(row.profile_pic);
    const profilePic = profilePicRaw ? profilePicRaw : null;

    result.push({
      cd,
      name,
      email: stringField(row.Email),
      phoneNumber: stringField(row["Phone Number"]),
      websiteHref,
      websiteDisplay: websiteRaw,
      aboutMe: stringField(row["About Me"]),
      profilePic,
    });
  }

  return result;
}
