import { afterEach, describe, expect, it, vi } from "vitest";
import { interpretQuestion, parseNeighborhoodIntent } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("interpretQuestion", () => {
  it("posts the question and validates the intent", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      expect(_url).toContain("/neighborhood-chat/interpret");
      expect(init.signal).toBeUndefined();
      return { ok: true, json: async () => ({ action: "find", resource_type: "parks", resource_name: null, neighborhood: null, field: null }) } as Response;
    }));
    await expect(interpretQuestion("parks", null)).resolves.toMatchObject({ action: "find", resource_type: "parks" });
  });

  it("rejects invalid JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ nope: true }) }) as Response));
    await expect(interpretQuestion("hello", null)).rejects.toThrow("Invalid neighborhood intent response");
  });

  it("rejects extra keys, empty names, and non-canonical neighborhoods", () => {
    const base = { action: "find", resource_type: null, resource_name: null, neighborhood: null, field: null };
    expect(() => parseNeighborhoodIntent({ ...base, extra: true })).toThrow();
    expect(() => parseNeighborhoodIntent({ ...base, resource_name: " " })).toThrow();
    expect(() => parseNeighborhoodIntent({ ...base, neighborhood: "studio city" })).toThrow();
  });
});
