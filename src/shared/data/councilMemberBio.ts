import type { DistrictProfile } from "../api/contracts";

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

function displayNameFromProfile(profile: DistrictProfile): string {
  const fromName = profile.name.trim();
  if (fromName) {
    return fromName;
  }
  return [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(" ");
}

/** Maps API `DistrictProfile` into the `CouncilMemberBio` view model (one row per `district_id` when building a map). */
export function councilMemberBioFromDistrictProfile(profile: DistrictProfile): CouncilMemberBio {
  const websiteRaw = (profile.website ?? "").trim();
  return {
    cd: profile.district_id,
    name: displayNameFromProfile(profile),
    email: (profile.email ?? "").trim(),
    phoneNumber: (profile.phone_number ?? "").trim(),
    websiteHref: normalizeCouncilWebsiteUrl(profile.website),
    websiteDisplay: websiteRaw,
    aboutMe: (profile.about ?? "").trim(),
    profilePic: profile.profile_pic?.trim() ? profile.profile_pic.trim() : null,
  };
}

export function biosMapFromDistrictProfiles(items: DistrictProfile[]): Map<number, CouncilMemberBio> {
  const map = new Map<number, CouncilMemberBio>();
  for (const profile of items) {
    if (!map.has(profile.district_id)) {
      map.set(profile.district_id, councilMemberBioFromDistrictProfile(profile));
    }
  }
  return map;
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/**
 * First + last name only, lowercased. Movers on council files carry their own council
 * member rows, whose names differ from the roster by case, punctuation, middle initials
 * and suffixes ("CURREN D. PRICE, JR." vs "Curren D. Price Jr."; "JOHN S. LEE" vs
 * "John Lee"), so those parts are dropped to let the two spellings meet.
 * Returns "" when the name has no usable first/last pair.
 */
export function councilMemberNameKey(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1 && !NAME_SUFFIXES.has(part));

  if (parts.length < 2) {
    return "";
  }
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Name → bio, for movers whose `district_id` is missing or the 0 "unknown" sentinel.
 * Names shared by more than one member are dropped rather than guessed, so a mover
 * never gets shown the wrong person's photo.
 */
export function biosMapByNameFromDistrictProfiles(
  items: DistrictProfile[],
): Map<string, CouncilMemberBio> {
  const byName = new Map<string, CouncilMemberBio | null>();
  for (const profile of items) {
    const bio = councilMemberBioFromDistrictProfile(profile);
    const key = councilMemberNameKey(bio.name);
    if (!key) {
      continue;
    }
    byName.set(key, byName.has(key) ? null : bio);
  }

  const resolved = new Map<string, CouncilMemberBio>();
  for (const [key, bio] of byName) {
    if (bio) {
      resolved.set(key, bio);
    }
  }
  return resolved;
}
