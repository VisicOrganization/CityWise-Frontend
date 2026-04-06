import type { DistrictProjectCard } from "../api/contracts";

/**
 * Street line for Nominatim: prefer nested `address_info.primary_address` (detail-aligned),
 * then top-level `primary_address` from district list.
 */
export function getPrimaryStreetForGeocoding(card: DistrictProjectCard): string | null {
  const nested = card.address_info?.primary_address;
  if (nested != null && String(nested).trim() !== "") {
    return String(nested).trim();
  }
  const flat = card.primary_address;
  if (flat != null && String(flat).trim() !== "") {
    return String(flat).trim();
  }
  return null;
}
