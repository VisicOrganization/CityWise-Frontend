import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as apiClient from "../../../shared/api/client";
import { resetCouncilMemberBiosCacheForTests } from "../../districts/useCouncilMemberBios";
import { CouncilMemberAvatar } from "./CouncilMemberAvatar";

const rosterMember = (district_id: number, name: string, profile_pic: string | null) => ({
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

async function avatarSrc(name: string): Promise<string | null | undefined> {
  const { container } = render(<CouncilMemberAvatar name={name} />);
  await waitFor(() => {
    expect(container.querySelector("img")).toBeInTheDocument();
  });
  return container.querySelector("img")?.getAttribute("src");
}

describe("CouncilMemberAvatar", () => {
  beforeEach(() => {
    resetCouncilMemberBiosCacheForTests();
    // The current roster only — former members are not in this list.
    vi.spyOn(apiClient, "fetchCouncilMembers").mockResolvedValue({
      items: [
        rosterMember(1, "Eunisses Hernandez", "https://img.example/hernandez.jpg"),
        rosterMember(2, "Adrin Nazarian", "https://img.example/nazarian.jpg"),
        rosterMember(9, "Curren D. Price Jr.", "https://img.example/price.jpg"),
        rosterMember(12, "John Lee", "https://img.example/lee.jpg"),
        rosterMember(13, "Hugo Soto-Martinez", "https://img.example/soto.jpg"),
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the headshot of a sitting member", async () => {
    await expect(avatarSrc("Eunisses Hernandez")).resolves.toBe("https://img.example/hernandez.jpg");
  });

  // Mover-side spellings: these two arrive uppercased, with a suffix or middle initial.
  it("matches a sitting member despite the mover-side name spelling", async () => {
    await expect(avatarSrc("CURREN D. PRICE, JR.")).resolves.toBe("https://img.example/price.jpg");
    await expect(avatarSrc("JOHN S. LEE")).resolves.toBe("https://img.example/lee.jpg");
  });

  // Former members still carry a district_id, so a district-keyed lookup used to hand
  // back the face of whoever holds that seat today.
  it("shows the placeholder for a former member, not the sitting member's face", async () => {
    await expect(avatarSrc("GILBERT A. CEDILLO")).resolves.toBe("/images/no-profile-picture.svg");
    await expect(avatarSrc("PAUL KREKORIAN")).resolves.toBe("/images/no-profile-picture.svg");
    await expect(avatarSrc("MITCH O'FARRELL")).resolves.toBe("/images/no-profile-picture.svg");
  });

  it("shows the placeholder when a roster member has no photo", async () => {
    vi.spyOn(apiClient, "fetchCouncilMembers").mockResolvedValue({
      items: [rosterMember(1, "Eunisses Hernandez", null)],
    });
    resetCouncilMemberBiosCacheForTests();

    await expect(avatarSrc("Eunisses Hernandez")).resolves.toBe("/images/no-profile-picture.svg");
  });
});
