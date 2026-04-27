import type { NavigateFunction } from "react-router-dom";

import { searchAddresses, type GeocodeSearchResult } from "./geocodeSearch";
import { findDistrictIdForPoint, loadDistrictBoundaries } from "./districtBoundaries";

/**
 * When present with `districtFocus`, the map should show project pins in that district only
 * (same as a completed address search that found a city district). Cleared on in-map
 * district selection like `focusLat` / `focusLng`.
 */
export const MAP_QUERY_DISTRICT_PIN_FILTER = "districtPinFilter" as const;

export async function buildMapSearchParamsFromAddress(
  queryLabel: string,
  selectedResult?: GeocodeSearchResult,
): Promise<URLSearchParams> {
  const trimmedQuery = queryLabel.trim();
  const nextParams = new URLSearchParams();

  if (!trimmedQuery) {
    return nextParams;
  }

  let primaryResult = selectedResult;
  if (!primaryResult) {
    const nextResults = await searchAddresses(trimmedQuery);
    primaryResult = nextResults[0];
  }

  if (primaryResult) {
    nextParams.set("focusLat", String(primaryResult.latitude));
    nextParams.set("focusLng", String(primaryResult.longitude));
    nextParams.set("focusLabel", trimmedQuery);
    try {
      const boundaries = await loadDistrictBoundaries();
      const districtId = findDistrictIdForPoint(boundaries, primaryResult.longitude, primaryResult.latitude);
      if (districtId !== null) {
        nextParams.set("districtFocus", String(districtId));
        nextParams.set("showDistrictProfile", "1");
      }
    } catch {
      /* resilient when boundaries lookup fails */
    }
  }

  return nextParams;
}

export async function navigateToMapFromAddressSearch(
  navigate: NavigateFunction,
  queryLabel: string,
  selectedResult?: GeocodeSearchResult,
) {
  const trimmedQuery = queryLabel.trim();
  if (!trimmedQuery) {
    navigate("/map");
    return;
  }

  const nextParams = await buildMapSearchParamsFromAddress(trimmedQuery, selectedResult);
  navigate(`/map?${nextParams.toString()}`);
}

export function navigateToMapForDistrictFocus(
  navigate: NavigateFunction,
  options: { districtId: number; focusLabel: string },
) {
  const nextParams = new URLSearchParams();
  nextParams.set("districtFocus", String(options.districtId));
  nextParams.set("showDistrictProfile", "1");
  nextParams.set(MAP_QUERY_DISTRICT_PIN_FILTER, "1");
  const label = options.focusLabel.trim();
  if (label) {
    nextParams.set("focusLabel", label);
  }
  navigate(`/map?${nextParams.toString()}`);
}

export async function applyMapSearchParamsFromAddress(
  setSearchParams: (next: URLSearchParams, options?: { replace?: boolean }) => void,
  queryLabel: string,
  selectedResult?: GeocodeSearchResult,
) {
  const trimmedQuery = queryLabel.trim();
  if (!trimmedQuery) {
    setSearchParams(new URLSearchParams(), { replace: true });
    return;
  }

  const nextParams = await buildMapSearchParamsFromAddress(trimmedQuery, selectedResult);
  setSearchParams(nextParams, { replace: true });
}

export function splitGeocodeDisplayLines(label: string): { primary: string; secondary: string } {
  const idx = label.indexOf(",");
  if (idx === -1) {
    return { primary: label.trim(), secondary: "" };
  }
  return {
    primary: label.slice(0, idx).trim(),
    secondary: label.slice(idx + 1).trim(),
  };
}

/** Leading street number is bold in the map search dropdown (Figma 1099:2153). */
export function geocodePrimaryLineParts(primary: string): { bold: string; rest: string } {
  const trimmed = primary.trim();
  const match = /^(\d+)\s*(.*)$/.exec(trimmed);
  if (match) {
    return { bold: match[1], rest: match[2] ? ` ${match[2]}` : "" };
  }
  return { bold: "", rest: trimmed };
}
