import { useEffect, useState } from "react";

/**
 * Static index of the 304 Countywide Statistical Areas in the LAHSA 2020 homeless count.
 *
 * `CsaDistrictSummary` needs each of District 2's neighborhoods by name and population whether
 * or not its polygon has loaded, so the list comes from this committed file rather than from the
 * map. (It predates the CD2 lock, when a filter dropdown needed all 304 up front; the file still
 * ships the full index because regenerating it is a single query, not because the page lists
 * them.) Keys deliberately match the tile attribute names so there is no mapping layer.
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
