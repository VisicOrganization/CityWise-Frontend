import { describe, expect, it } from "vitest";

import {
  biosMapByNameFromDistrictProfiles,
  biosMapFromDistrictProfiles,
  councilMemberBioFromDistrictProfile,
  councilMemberNameKey,
  normalizeCouncilWebsiteUrl,
  parseCouncilMemberBiosPayload,
} from "./councilMemberBio";

describe("normalizeCouncilWebsiteUrl", () => {
  it("returns null for empty input", () => {
    expect(normalizeCouncilWebsiteUrl(null)).toBeNull();
    expect(normalizeCouncilWebsiteUrl(undefined)).toBeNull();
    expect(normalizeCouncilWebsiteUrl("   ")).toBeNull();
  });

  it("preserves existing schemes", () => {
    expect(normalizeCouncilWebsiteUrl("https://cd11.lacity.gov/")).toBe("https://cd11.lacity.gov/");
    expect(normalizeCouncilWebsiteUrl("http://example.com")).toBe("http://example.com");
  });

  it("prefixes https when scheme is missing", () => {
    expect(normalizeCouncilWebsiteUrl("councildistrict5.lacity.gov")).toBe(
      "https://councildistrict5.lacity.gov",
    );
  });
});

describe("parseCouncilMemberBiosPayload", () => {
  it("returns empty array for non-array JSON", () => {
    expect(parseCouncilMemberBiosPayload(null)).toEqual([]);
    expect(parseCouncilMemberBiosPayload({})).toEqual([]);
  });

  it("parses valid rows and skips invalid entries", () => {
    const rows = parseCouncilMemberBiosPayload([
      { CD: 1, Name: "Test Member", Email: "a@b.org", "Phone Number": "1", "Website Link": "https://x/", "About Me": "Hi" },
      { CD: "bad", Name: "X" },
      { CD: 2, Name: "" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cd).toBe(1);
    expect(rows[0]?.name).toBe("Test Member");
    expect(rows[0]?.websiteHref).toBe("https://x/");
    expect(rows[0]?.aboutMe).toBe("Hi");
    expect(rows[0]?.profilePic).toBeNull();
  });

  it("parses profile_pic when present", () => {
    const rows = parseCouncilMemberBiosPayload([
      {
        CD: 1,
        Name: "A",
        Email: "",
        "Phone Number": "",
        "Website Link": "",
        "About Me": "",
        profile_pic: " https://example.com/p.jpg ",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.profilePic).toBe("https://example.com/p.jpg");
  });
});

describe("councilMemberBioFromDistrictProfile", () => {
  const baseProfile = {
    id: 1,
    district_id: 11,
    name: "Jordan Alvarez",
    first_name: null,
    last_name: null,
    email: "j@example.org",
    phone_number: "(213) 555-0100",
    website: "cd11.lacity.gov",
    about: "About text",
    impact_summary: null,
    profile_pic: " https://img.example/p.png ",
    is_active: "Y",
  };

  it("maps API fields to CouncilMemberBio", () => {
    const bio = councilMemberBioFromDistrictProfile(baseProfile);
    expect(bio.cd).toBe(11);
    expect(bio.name).toBe("Jordan Alvarez");
    expect(bio.email).toBe("j@example.org");
    expect(bio.phoneNumber).toBe("(213) 555-0100");
    expect(bio.websiteHref).toBe("https://cd11.lacity.gov");
    expect(bio.websiteDisplay).toBe("cd11.lacity.gov");
    expect(bio.aboutMe).toBe("About text");
    expect(bio.profilePic).toBe("https://img.example/p.png");
  });

  it("uses first and last name when name is blank", () => {
    const bio = councilMemberBioFromDistrictProfile({
      ...baseProfile,
      name: "  ",
      first_name: "Ada",
      last_name: "Lovelace",
    });
    expect(bio.name).toBe("Ada Lovelace");
  });
});

describe("biosMapFromDistrictProfiles", () => {
  it("keeps the first profile per district_id", () => {
    const map = biosMapFromDistrictProfiles([
      {
        id: 1,
        district_id: 11,
        name: "First",
        first_name: null,
        last_name: null,
        email: null,
        phone_number: null,
        website: null,
        about: null,
        impact_summary: null,
        profile_pic: null,
        is_active: "Y",
      },
      {
        id: 2,
        district_id: 11,
        name: "Second",
        first_name: null,
        last_name: null,
        email: null,
        phone_number: null,
        website: null,
        about: null,
        impact_summary: null,
        profile_pic: null,
        is_active: "Y",
      },
    ]);
    expect(map.size).toBe(1);
    expect(map.get(11)?.name).toBe("First");
  });
});

describe("councilMemberNameKey", () => {
  it("collapses the mover and roster spellings of the same member", () => {
    // Names as they actually arrive: roster (/council-members) vs mover (/projects/:id).
    expect(councilMemberNameKey("Curren D. Price Jr.")).toBe("curren price");
    expect(councilMemberNameKey("Curren D. Price, Jr.")).toBe("curren price");
    expect(councilMemberNameKey("CURREN D. PRICE, JR.")).toBe("curren price");

    expect(councilMemberNameKey("John Lee")).toBe("john lee");
    expect(councilMemberNameKey("JOHN S. LEE")).toBe("john lee");
  });

  it("keeps hyphenated surnames intact", () => {
    expect(councilMemberNameKey("Marqueece Harris-Dawson")).toBe("marqueece harris-dawson");
  });

  it("returns empty for names without a first/last pair", () => {
    expect(councilMemberNameKey("")).toBe("");
    expect(councilMemberNameKey("Price")).toBe("");
    expect(councilMemberNameKey("J. R.")).toBe("");
  });
});

describe("biosMapByNameFromDistrictProfiles", () => {
  const profile = (district_id: number, name: string, profile_pic: string | null) => ({
    id: district_id,
    district_id,
    name,
    first_name: null,
    last_name: null,
    email: null,
    phone_number: null,
    website: null,
    about: null,
    impact_summary: null,
    profile_pic,
    is_active: "Y",
  });

  it("finds the roster member from a mover-side name spelling", () => {
    const map = biosMapByNameFromDistrictProfiles([
      profile(9, "Curren D. Price Jr.", "https://img.example/price.jpg"),
      profile(12, "John Lee", "https://img.example/lee.jpg"),
    ]);

    expect(map.get(councilMemberNameKey("CURREN D. PRICE, JR."))?.profilePic).toBe(
      "https://img.example/price.jpg",
    );
    expect(map.get(councilMemberNameKey("JOHN S. LEE"))?.profilePic).toBe(
      "https://img.example/lee.jpg",
    );
  });

  it("drops names shared by more than one member rather than guessing", () => {
    const map = biosMapByNameFromDistrictProfiles([
      profile(4, "David Ryu", "https://img.example/a.jpg"),
      profile(13, "David E. Ryu", "https://img.example/b.jpg"),
    ]);

    expect(map.has("david ryu")).toBe(false);
  });
});
