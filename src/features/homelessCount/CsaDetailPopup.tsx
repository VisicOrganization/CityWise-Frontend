/**
 * Click-to-inspect card for one Countywide Statistical Area.
 *
 * Purely presentational and fetch-free: every field below is already carried in the Scout tile's
 * feature attributes, so a click costs no network request. Values are read defensively because
 * they arrive from a third-party tile, not from our own types.
 */
export interface CsaDetailPopupProps {
  properties: Record<string, unknown>;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatCount(value: unknown): string {
  const count = readNumber(value);
  return count === null ? "—" : count.toLocaleString();
}

// Plain Math.round() silently turns real, non-zero densities into "0". City of Compton's
// Density_Sheltered is 0.211 with Total_Sheltered_Pop = 2 — rounding produced a card that showed
// "Sheltered: 2" directly above "Density (sheltered): 0 per sq. mile", contradicting itself, and
// re-created the exact "counted nobody" vs. "very low density" confusion that csaLayers.ts gives
// exact zeros their own legend class to avoid. Below 1 (and above 0) we keep 2 significant digits
// so a value like 0.0096 still reads as clearly non-zero; an exact 0 stays "0", never "0.00"; and
// 1 or more stays whole-number rounded with thousands separators, unchanged from before.
function formatDensity(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "0";
  if (value < 1) {
    return value.toLocaleString(undefined, {
      minimumSignificantDigits: 2,
      maximumSignificantDigits: 2,
    });
  }
  return Math.round(value).toLocaleString();
}

export function CsaDetailPopup({ properties }: CsaDetailPopupProps) {
  const label = readText(properties.CSA_Label) || "Unnamed area";
  const density = readNumber(properties.Density_Total);
  const densityUnsheltered = readNumber(properties.Density_Unsheltered);
  const densitySheltered = readNumber(properties.Density_Sheltered);
  const squareMiles = readNumber(properties.Square_Miles);
  const dataSource = readText(properties.Data_Source);

  return (
    <div className="homeless-count-popup">
      <h2 className="homeless-count-popup-title">{label}</h2>

      <dl className="homeless-count-popup-stats">
        <div className="homeless-count-popup-stat">
          <dt>People counted</dt>
          <dd>{formatCount(properties.Total_Pop)}</dd>
        </div>
        <div className="homeless-count-popup-stat">
          <dt>Unsheltered</dt>
          <dd>{formatCount(properties.Total_Unsheltered_Pop)}</dd>
        </div>
        <div className="homeless-count-popup-stat">
          <dt>Sheltered</dt>
          <dd>{formatCount(properties.Total_Sheltered_Pop)}</dd>
        </div>

        {/*
          Grouped together (own wrapper, border-topped in app.css) rather than three loose rows,
          mirroring how People counted / Unsheltered / Sheltered above already read as one family
          — three related per-sq-mile figures, not one density row plus two orphaned extras.
          Rounded the same way Density_Total always has been, so all three are consistent.

          Unlike the shelter popup's optional fields, these three are always present in this
          dataset — a missing one signals a real data problem, so it stays visible as "—" rather
          than being silently skipped.

          Deliberately NOT rendered anywhere in this card: OGC_FID, OBJECTID, Shape__Area,
          Shape__Length. Those are internal GIS row identifiers and raw geometry measures, not
          something a resident reads a homeless-count card to learn, and Square_Miles above
          already carries area in a usable unit. This omission is intentional — please don't
          "complete" the list with them later.
        */}
        <div className="homeless-count-popup-density-group">
          <div className="homeless-count-popup-stat">
            <dt>Density (total)</dt>
            <dd>
              {density === null ? "—" : `${formatDensity(density)} per sq. mile`}
              {squareMiles === null
                ? null
                : ` over ${squareMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} sq. mi`}
            </dd>
          </div>
          <div className="homeless-count-popup-stat">
            <dt>Density (unsheltered)</dt>
            <dd>
              {densityUnsheltered === null ? "—" : `${formatDensity(densityUnsheltered)} per sq. mile`}
            </dd>
          </div>
          <div className="homeless-count-popup-stat">
            <dt>Density (sheltered)</dt>
            <dd>
              {densitySheltered === null ? "—" : `${formatDensity(densitySheltered)} per sq. mile`}
            </dd>
          </div>
        </div>
      </dl>

      {/* How Glendale, Pasadena and Long Beach reveal they are counted citywide, not by tract. */}
      {dataSource ? <p className="homeless-count-popup-source">Source: {dataSource}</p> : null}

      <p className="homeless-count-popup-footer">2020 Point-in-Time count</p>
    </div>
  );
}
