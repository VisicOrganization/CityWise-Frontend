import { useEffect, useState } from "react";

/**
 * Static index of the 304 Countywide Statistical Areas in the LAHSA 2020 homeless count.
 *
 * The map itself reads every attribute straight off the Scout vector tiles, but the filter
 * dropdown needs the *full* list of neighborhoods up front — and tiles only ever expose the
 * features currently loaded in the viewport. So the name list comes from this committed file
 * instead. Keys deliberately match the tile attribute names so there is no mapping layer.
 *
 * Regenerate with (verified 2026-09-17, returns exactly 304 features, no paging needed):
 *
 *   curl -s 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Homeless_Counts_2020/FeatureServer/0/query?where=1%3D1&outFields=CSA_Label,Total_Pop&returnGeometry=false&orderByFields=CSA_Label&f=json' \
 *     | jq '[.features[].attributes]' > public/data/lahsa-2020-csa-index.json
 *
 * `orderByFields` keeps the committed file deterministic so regenerating produces a clean diff.
 */

export type CsaGroupKey = "losAngeles" | "cities" | "unincorporated";

export interface CsaRow {
  /** Full label as it appears in the tile attributes, e.g. "Los Angeles - Venice". */
  CSA_Label: string;
  Total_Pop: number;
  /** Label with its family prefix removed, e.g. "Venice". Display only — never a lookup key. */
  displayName: string;
  group: CsaGroupKey;
}

export interface CsaGroup {
  key: CsaGroupKey;
  title: string;
  rows: CsaRow[];
}

/** Render order for the three families. */
export const CSA_GROUP_ORDER: CsaGroupKey[] = ["losAngeles", "cities", "unincorporated"];

export const CSA_GROUP_TITLES: Record<CsaGroupKey, string> = {
  losAngeles: "Los Angeles",
  cities: "Cities",
  unincorporated: "Unincorporated areas",
};

/** Exported so the left panel's data-sources section can name the file this page actually
 * fetches instead of restating it — see `dataSources.ts`. */
export const CSA_INDEX_PATH = new URL("data/lahsa-2020-csa-index.json", window.location.origin + import.meta.env.BASE_URL).toString();

/**
 * All 304 labels fall into exactly these three prefixes (verified against the live layer).
 * An unrecognised label keeps its raw text and lands in `cities` rather than being dropped —
 * the file can change out from under us, and a visible odd entry beats a silently missing one.
 */
export function stripCsaPrefix(label: string): { group: CsaGroupKey; displayName: string } {
  if (label.startsWith("Los Angeles - ")) {
    return { group: "losAngeles", displayName: label.slice("Los Angeles - ".length) };
  }
  if (label.startsWith("City of ")) {
    return { group: "cities", displayName: label.slice("City of ".length) };
  }
  if (label.startsWith("Unincorporated - ")) {
    return { group: "unincorporated", displayName: label.slice("Unincorporated - ".length) };
  }
  return { group: "cities", displayName: label };
}

export function parseCsaIndexPayload(data: unknown): CsaRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows: CsaRow[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const label = typeof record.CSA_Label === "string" ? record.CSA_Label.trim() : "";
    const total = record.Total_Pop;
    if (!label || typeof total !== "number" || !Number.isFinite(total)) {
      continue;
    }
    rows.push({ CSA_Label: label, Total_Pop: total, ...stripCsaPrefix(label) });
  }
  return rows;
}

/** Groups in fixed family order, each sorted by display name. */
export function groupCsaRows(rows: CsaRow[]): CsaGroup[] {
  return CSA_GROUP_ORDER.map((key) => ({
    key,
    title: CSA_GROUP_TITLES[key],
    rows: rows
      .filter((row) => row.group === key)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
  }));
}

/**
 * Matches the stripped display name *and* the raw label, so both "venice" and "unincorporated"
 * find rows. Case-insensitive, no debounce at the call site — 304 in-memory strings is instant.
 */
export function filterCsaRows(rows: CsaRow[], query: string): CsaRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rows;
  }
  return rows.filter(
    (row) =>
      row.displayName.toLowerCase().includes(needle) || row.CSA_Label.toLowerCase().includes(needle),
  );
}

let csaIndexPromise: Promise<CsaRow[]> | null = null;

export function resetCsaIndexCacheForTests(): void {
  csaIndexPromise = null;
}

export function loadCsaIndexOnce(): Promise<CsaRow[]> {
  if (!csaIndexPromise) {
    csaIndexPromise = fetch(CSA_INDEX_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load the neighborhood index");
        }
        return response.json();
      })
      .then(parseCsaIndexPayload)
      .catch((error) => {
        // Clear the memo so a transient failure can be retried on the next mount.
        csaIndexPromise = null;
        throw error;
      });
  }
  return csaIndexPromise;
}

interface UseCsaIndexResult {
  rows: CsaRow[] | null;
  error: string | null;
  isLoading: boolean;
}

export function useCsaIndex(): UseCsaIndexResult {
  const [rows, setRows] = useState<CsaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    loadCsaIndexOnce()
      .then((loaded) => {
        if (ignore) return;
        setRows(loaded);
        setError(null);
      })
      .catch(() => {
        if (ignore) return;
        setRows(null);
        setError("Neighborhood list could not be loaded.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return { rows, error, isLoading };
}
