import type { NeighborhoodIntent } from "./contracts";

const ACTIONS = new Set(["find", "nearest", "details", "clarify", "unsupported", "out_of_scope"]);
const FIELDS = new Set(["address", "phone", "email", "website", "meeting_information", "serves", "location"]);
const TYPES = new Set(["parks", "police", "fire", "libraries", "neighborhood_councils", "community", "business", "markets", "arts", "housing", "district_office", "transport", "all"]);
const NEIGHBORHOODS = new Set(["North Hollywood", "Studio City", "Sun Valley", "Toluca Lake", "Valley Glen", "Valley Village", "Van Nuys"]);

function validNullableString(value: unknown): value is string | null { return value === null || typeof value === "string"; }

export function parseNeighborhoodIntent(payload: unknown): NeighborhoodIntent {
  if (!payload || typeof payload !== "object") throw new Error("Invalid neighborhood intent response");
  const value = payload as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== ["action", "field", "neighborhood", "resource_name", "resource_type"].join(",") ||
      !ACTIONS.has(value.action as string) || (value.resource_type !== null && !TYPES.has(value.resource_type as string)) ||
      !validNullableString(value.resource_name) || (typeof value.resource_name === "string" && (value.resource_name.trim() === "" || value.resource_name.length > 200)) ||
      !validNullableString(value.neighborhood) || (typeof value.neighborhood === "string" && !NEIGHBORHOODS.has(value.neighborhood)) ||
      (value.field !== null && !FIELDS.has(value.field as string))) throw new Error("Invalid neighborhood intent response");
  return value as unknown as NeighborhoodIntent;
}

export async function interpretNeighborhood(
  question: string,
  context: Partial<NeighborhoodIntent> | null = null,
  signal?: AbortSignal,
): Promise<NeighborhoodIntent> {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:18100").replace(/\/$/, "");
  const response = await fetch(`${base}/neighborhood-chat/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
    signal,
  });
  if (!response.ok) throw new Error(`Neighborhood chat request failed: ${response.status}`);
  return parseNeighborhoodIntent(await response.json());
}

export const interpretQuestion = interpretNeighborhood;
