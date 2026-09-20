import type { AssetProperties } from "./cd2Assets";
import { CATEGORY_LABELS } from "./neighborhoodMapLayers";

/**
 * Click card for one civic asset.
 *
 * Presentational and fetch-free: every field is already on the GeoJSON feature.
 *
 * Fields render only when present, which is the point rather than a nicety -- across the 81
 * source rows `email` is filled on 11 and `meeting_information` on 14, so a fixed six-row
 * layout would be mostly blank labels. Values are read defensively because they come from a
 * generated file, not from a typed API response.
 */
export interface NeighborhoodAssetPopupProps {
  properties: Partial<AssetProperties>;
  /** The district whose panel this is, so an out-of-district pin can say so. */
  districtId: number;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strips the scheme so a long URL reads as a domain rather than wrapping over three lines. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function NeighborhoodAssetPopup({ properties, districtId }: NeighborhoodAssetPopupProps) {
  const label = readText(properties.label) || "Unnamed location";
  const category = readText(properties.category);
  const address = readText(properties.address);
  const phone = readText(properties.phone);
  const email = readText(properties.email);
  const meeting = readText(properties.meeting_information);
  const website = readText(properties.website);
  const serves = readText(properties.serves);
  const district =
    typeof properties.council_district === "number" ? properties.council_district : null;

  return (
    <div className="neighborhood-asset-popup">
      <p className="neighborhood-asset-popup-eyebrow">
        {CATEGORY_LABELS[category] ?? category ?? ""}
      </p>
      <h3 className="neighborhood-asset-popup-title">{label}</h3>

      {address ? <p className="neighborhood-asset-popup-address">{address}</p> : null}

      <dl className="neighborhood-asset-popup-fields">
        {phone ? (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
            </dd>
          </div>
        ) : null}
        {email ? (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        ) : null}
        {meeting ? (
          <div>
            <dt>Meetings</dt>
            <dd>{meeting}</dd>
          </div>
        ) : null}
        {website ? (
          <div>
            <dt>Website</dt>
            <dd>
              <a href={website} target="_blank" rel="noreferrer noopener">
                {linkText(website)}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {serves ? (
        <p className="neighborhood-asset-popup-note">Serves {serves}.</p>
      ) : null}

      {/* The source page lists facilities that serve a neighbourhood, and some of them sit in
          a neighbouring district. Saying which one is more useful than hiding the pin. */}
      {district !== null && district !== districtId ? (
        <p className="neighborhood-asset-popup-note">
          Located in Council District {district}.
        </p>
      ) : null}
    </div>
  );
}
