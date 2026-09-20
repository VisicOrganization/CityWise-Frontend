/**
 * Persists the homeless-count filter's hidden-CSA set across reloads and route changes (React
 * Router unmounts the page on navigation, so component state alone does not survive a round trip).
 *
 * The `citywise:` prefix is required, not cosmetic: `cityWiseLocalStorage.ts` wipes every key with
 * that prefix once per calendar day, and this feature deliberately participates in that reset.
 */

const HIDDEN_CSA_STORAGE_KEY = "citywise:homelessCountHidden";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

/**
 * `null` means no explicit choice was ever stored — no key, unparseable JSON, a parsed value
 * that isn't an array, or a storage read that throws (private-mode / blocked-cookie browsers).
 * A stored empty array is a real choice ("show everything") and comes back as an empty Set, not
 * `null` — callers rely on the distinction to apply a default only when nothing was chosen.
 * Stored labels are not cross-checked against the loaded rows — a stale label is simply inert.
 */
export function readHiddenCsaLabels(): Set<string> | null {
  try {
    const storage = getStorage();
    const raw = storage?.getItem(HIDDEN_CSA_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return null;
  }
}

export function writeHiddenCsaLabels(hidden: Set<string>): void {
  try {
    const storage = getStorage();
    storage?.setItem(HIDDEN_CSA_STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // Private-mode / blocked-cookie browsers throw on write; losing persistence here is fine.
  }
}
