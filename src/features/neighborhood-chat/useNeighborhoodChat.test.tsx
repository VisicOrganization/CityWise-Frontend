import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetCollection } from "../map/cd2Assets";
import type { NeighborhoodIntent } from "./contracts";
import { interpretQuestion } from "./client";
import { useNeighborhoodChat } from "./useNeighborhoodChat";

vi.mock("./client", () => ({ interpretQuestion: vi.fn() }));
const api = vi.mocked(interpretQuestion);
const assets: AssetCollection = { type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Point", coordinates: [-118.4, 34.16] }, properties: {
    label: "First Park", category: "RECREATION & PARKS", neighborhood: "Studio City", address: "10 Park St", precision: "rooftop", council_district: 2,
  } },
  { type: "Feature", geometry: { type: "Point", coordinates: [-118.42, 34.17] }, properties: {
    label: "Second Park", category: "RECREATION & PARKS", neighborhood: "Studio City", address: "20 Park St", precision: "rooftop", council_district: 2,
  } },
] };
const intent = (action: NeighborhoodIntent["action"] = "find", extra: Partial<NeighborhoodIntent> = {}): NeighborhoodIntent => ({
  action, resource_type: "parks", resource_name: null, neighborhood: null, field: null, ...extra,
});

beforeEach(() => { api.mockReset(); });

describe("neighborhood conversation", () => {
  it("shows broad results then resolves a nearest follow-up locally from a chosen point", async () => {
    api.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent("nearest"));
    const { result } = renderHook(() => useNeighborhoodChat(assets));
    await act(async () => { await result.current.send("Where are the parks?"); });
    expect(result.current.result?.items).toHaveLength(2);
    await act(async () => { await result.current.send("Which is nearest?"); });
    expect(result.current.pending?.needs).toBe("point");
    expect(result.current.result?.items).toHaveLength(2);
    act(() => result.current.chooseNeighborhood("Studio City"));
    expect(result.current.intent?.neighborhood).toBe("Studio City");
    act(() => result.current.choosePoint({ longitude: -118.4, latitude: 34.16 }));
    expect(result.current.pending).toBeNull();
    expect(result.current.result?.items[0].properties.label).toBe("First Park");
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("keeps prior results for off-topic prompts without replacing context", async () => {
    api.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent("out_of_scope"));
    const { result } = renderHook(() => useNeighborhoodChat(assets));
    await act(async () => { await result.current.send("parks"); });
    await act(async () => { await result.current.send("tell a joke"); });
    expect(result.current.intent?.action).toBe("find");
    expect(result.current.result?.items).toHaveLength(2);
  });

  it("offers detail candidates and answers only the record selected locally", async () => {
    api.mockResolvedValue(intent("details", { field: "phone" }));
    const { result } = renderHook(() => useNeighborhoodChat(assets));
    await act(async () => { await result.current.send("What's its phone number?"); });
    expect(result.current.pending?.items).toHaveLength(2);
    act(() => result.current.chooseResource(result.current.pending!.items[1]));
    expect(result.current.result?.items[0].properties.label).toBe("Second Park");
    expect(result.current.messages.at(-1)?.text).toMatch(/does not record/);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("resolves a named find ambiguity to exactly the chosen key", async () => {
    const duplicates: AssetCollection = { ...assets, features: assets.features.map((feature) => ({ ...feature,
      properties: { ...feature.properties, label: "Shared Park" },
    })) };
    duplicates.features[1].properties.neighborhood = "Valley Village";
    api.mockResolvedValue(intent("find", { resource_name: "Shared Park" }));
    const { result } = renderHook(() => useNeighborhoodChat(duplicates));
    await act(async () => { await result.current.send("Where is Shared Park?"); });
    expect(result.current.pending?.needs).toBe("resource");
    const choice = result.current.pending!.items[1];
    act(() => result.current.chooseResource(choice));
    expect(result.current.pending).toBeNull();
    expect(result.current.result?.items.map((item) => item.key)).toEqual([choice.key]);
    expect(result.current.messages.at(-1)?.text).toContain("20 Park St");
  });

  it("ignores a completed response after reset even if the provider ignores abort", async () => {
    let finish!: (value: NeighborhoodIntent) => void;
    api.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useNeighborhoodChat(assets));
    act(() => { void result.current.send("parks"); });
    await waitFor(() => expect(result.current.isSending).toBe(true));
    act(() => result.current.reset());
    await act(async () => { finish(intent()); });
    expect(result.current.messages).toEqual([]);
    expect(result.current.result).toBeNull();
    expect(result.current.isSending).toBe(false);
  });

  it("shows a recoverable failure and retries without duplicating the user turn", async () => {
    api.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(intent());
    const { result } = renderHook(() => useNeighborhoodChat(assets));
    await act(async () => { await result.current.send("parks"); });
    expect(result.current.error).toMatch(/unavailable/);
    await act(async () => { await result.current.send(result.current.lastQuestion, true); });
    expect(result.current.error).toBeNull();
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });
});
