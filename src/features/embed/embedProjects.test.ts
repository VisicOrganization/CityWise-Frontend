import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadEmbedProjectsOnce, resetEmbedProjectsCacheForTests } from "./embedProjects";

beforeEach(() => {
  resetEmbedProjectsCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const VALID_PAYLOAD = {
  generated_at: "2026-09-01T00:00:00.000Z",
  district_id: 2,
  projects: [
    {
      id: "25-0358",
      title: "Sample project",
      category: "Housing",
      latitude: 34.19,
      longitude: -118.41,
      url: "https://cityclerk.lacity.org/example",
    },
  ],
};

describe("loadEmbedProjectsOnce", () => {
  // The primary fallback this task calls out: the file may not exist yet.
  it("resolves to null on a 404, with no throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 }) as Response),
    );
    await expect(loadEmbedProjectsOnce()).resolves.toBeNull();
  });

  it("resolves to null when the response body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }) as unknown as Response),
    );
    await expect(loadEmbedProjectsOnce()).resolves.toBeNull();
  });

  it("resolves to null when fetch itself rejects (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(loadEmbedProjectsOnce()).resolves.toBeNull();
  });

  it("resolves to null for a malformed top-level payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }) as unknown as Response),
    );
    await expect(loadEmbedProjectsOnce()).resolves.toBeNull();
  });

  it("parses a well-formed payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => VALID_PAYLOAD }) as unknown as Response),
    );
    await expect(loadEmbedProjectsOnce()).resolves.toEqual({
      generatedAt: "2026-09-01T00:00:00.000Z",
      districtId: 2,
      projects: [
        {
          id: "25-0358",
          title: "Sample project",
          category: "Housing",
          latitude: 34.19,
          longitude: -118.41,
          url: "https://cityclerk.lacity.org/example",
        },
      ],
    });
  });

  it("drops individual malformed rows but keeps the well-formed ones", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      projects: [
        VALID_PAYLOAD.projects[0],
        { id: "bad", title: "Missing coordinates", category: "Housing" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response),
    );
    const result = await loadEmbedProjectsOnce();
    expect(result?.projects).toHaveLength(1);
    expect(result?.projects[0].id).toBe("25-0358");
  });

  it("memoizes across callers", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => VALID_PAYLOAD }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([loadEmbedProjectsOnce(), loadEmbedProjectsOnce()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
