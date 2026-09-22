import {
  assetKey,
  selectAllAssets,
  type AssetCollection,
  type AssetProperties,
  type PanelAsset,
} from "../map/cd2Assets";
import type { NeighborhoodIntent, Origin, ResourceResolution, ResourceType } from "./contracts";
export type { Origin, ResourceResolution as Resolution } from "./contracts";

export const NEIGHBORHOODS = [
  "North Hollywood",
  "Studio City",
  "Sun Valley",
  "Toluca Lake",
  "Valley Glen",
  "Valley Village",
  "Van Nuys",
] as const;

export const RESOURCE_TYPES: readonly ResourceType[] = [
  "parks", "police", "fire", "libraries", "neighborhood_councils", "community",
  "business", "markets", "arts", "housing", "district_office", "transport", "all",
];

const REVIEWED_TAGS: Record<string, ResourceType[]> = {
  "whitsett ave sports complex": ["parks"],
  "homes4famiilies veterans housing": ["housing"],
};

const DISTRICT = 2;
const normalize = (value: string): string =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function servedBy(properties: AssetProperties): string[] {
  const values = (properties.serves ?? properties.neighborhood ?? "").split(",").map((v) => normalize(v));
  return values.filter((v) => v && v !== "districtwide" && v !== "multiple neighborhoods");
}

function resourceTypes(properties: AssetProperties): ResourceType[] {
  const label = normalize(properties.label);
  const category = normalize(properties.category);
  if (REVIEWED_TAGS[label]) return REVIEWED_TAGS[label];
  const types: ResourceType[] = [];
  if (category === "recreation parks" || /park|recreation|open space|green belt|dog park/.test(label)) types.push("parks");
  if (category === "public safety" && /police/.test(label)) types.push("police");
  if (category === "public safety" && /fire station/.test(label)) types.push("fire");
  if (/library/.test(label)) types.push("libraries");
  if (/neighborhood council/.test(label)) types.push("neighborhood_councils");
  if (category !== "public safety" && /association|homeowners|residents|community|recreation center/.test(label)) types.push("community");
  if (/business improvement|chamber of commerce/.test(label)) types.push("business");
  if (/farmers market/.test(label)) types.push("markets");
  if (/arts|mural|gallery|historic site/.test(label)) types.push("arts");
  if (/housing|homes4families/.test(label)) types.push("housing");
  if (/district office/.test(label)) types.push("district_office");
  if (/bike path|intersection|grade crossing|median/.test(label)) types.push("transport");
  return types;
}

function matchesType(asset: PanelAsset, type: ResourceType | null): boolean {
  return !type || type === "all" || resourceTypes(asset.properties).includes(type);
}

function nameMatches(asset: PanelAsset, query: string | null): boolean {
  if (!query) return true;
  const name = normalize(asset.properties.label);
  const wanted = normalize(query);
  return name === wanted || name.includes(wanted) || wanted.includes(name);
}

function fieldLabel(field: NonNullable<NeighborhoodIntent["field"]>): string {
  return field === "meeting_information" ? "meeting information" : field;
}

function locationLabel(asset: PanelAsset): string {
  const outside = asset.properties.council_district !== undefined && asset.properties.council_district !== DISTRICT;
  return `${asset.properties.label}${outside ? " (located outside Council District 2)" : ""}`;
}

function factualAnswer(asset: PanelAsset, field: NeighborhoodIntent["field"]): string {
  if (field === "location") return `${locationLabel(asset)} is at ${asset.properties.address ?? "an address not recorded in the district dataset"}.`;
  if (field) {
    const value = field === "serves" ? (asset.properties.serves || asset.properties.neighborhood) : asset.properties[field];
    return value
      ? `${locationLabel(asset)} ${fieldLabel(field)} is ${value}.`
      : `The district dataset does not record a ${fieldLabel(field)} for ${asset.properties.label}.`;
  }
  return `${locationLabel(asset)} is at ${asset.properties.address ?? "an address not recorded in the district dataset"}.`;
}

function haversineMiles(a: PanelAsset, origin: { longitude: number; latitude: number }): number {
  const radius = 3958.7613;
  const radians = (n: number) => (n * Math.PI) / 180;
  const dLat = radians(a.latitude - origin.latitude);
  const dLon = radians(a.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(a.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function resolveResources(
  assets: AssetCollection,
  intent: NeighborhoodIntent,
  origin: Origin | null,
  selectedKey: string | null = null,
): ResourceResolution {
  if (intent.action === "unsupported") {
    return { answer: "That information is not recorded in the resource cards; I can help with listed locations and contact details.", items: [], distances: {}, needs: null };
  }
  if (intent.action === "out_of_scope") {
    return { answer: "I can only help with resources listed for Council District 2.", items: [], distances: {}, needs: null };
  }
  if (intent.action === "clarify") return { answer: "Please specify a resource or neighborhood.", items: [], distances: {}, needs: "query" };
  if (intent.action === "find" && !intent.resource_type && !intent.resource_name && !intent.neighborhood) return { answer: "Which kind of resource would you like to find?", items: [], distances: {}, needs: "query" };
  if (intent.action === "nearest" && !origin) return { answer: "Share a map point so I can find the nearest resource.", items: [], distances: {}, needs: "point" };

  const all = selectAllAssets(assets);
  const knownNeighborhood = intent.neighborhood ? NEIGHBORHOODS.some((name) => normalize(name) === normalize(intent.neighborhood!)) : true;
  if (!knownNeighborhood) return { answer: `I don't have district resource data for ${intent.neighborhood}.`, items: [], distances: {}, needs: null };

  let candidates = all.filter((asset) => matchesType(asset, intent.resource_type));
  if (intent.neighborhood) candidates = candidates.filter((asset) => servedBy(asset.properties).includes(normalize(intent.neighborhood!)));

  if (intent.action === "details" && !intent.resource_name) {
    if (selectedKey) {
      const selected = all.find((asset) => asset.key === selectedKey);
      candidates = selected ? [selected] : [];
    } else {
      return { answer: "Select a resource to see its details.", items: candidates, distances: {}, needs: "resource" };
    }
  } else if (intent.resource_name) {
    candidates = candidates.filter((asset) => nameMatches(asset, intent.resource_name));
  }

  if (candidates.length === 0) return { answer: "I couldn't find a matching resource in the district dataset.", items: [], distances: {}, needs: null };
  if (candidates.length > 1 && intent.action !== "nearest" && (Boolean(intent.resource_name) || intent.action === "details")) {
    return { answer: "I found several matching resources. Please choose one.", items: candidates, distances: {}, needs: "resource" };
  }

  const distances: Record<string, number> = {};
  if (origin) for (const asset of candidates) distances[asset.key] = haversineMiles(asset, origin);
  if (intent.action === "nearest") {
    candidates.sort((a, b) => distances[a.key] - distances[b.key]);
    candidates = candidates.slice(0, 3);
  }
  const answer = intent.action === "nearest"
    ? `${locationLabel(candidates[0])} is the closest listed match, approximately ${distances[candidates[0].key].toFixed(1)} miles in a straight line from your map point.`
    : candidates.length === 1 ? factualAnswer(candidates[0], intent.field) : `${candidates.length} resources found.`;
  return { answer, items: candidates, distances, needs: null };
}

export { assetKey };
