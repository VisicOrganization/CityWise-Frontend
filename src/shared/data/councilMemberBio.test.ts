import { describe, expect, it } from "vitest";

import { normalizeCouncilWebsiteUrl, parseCouncilMemberBiosPayload } from "./councilMemberBio";

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
