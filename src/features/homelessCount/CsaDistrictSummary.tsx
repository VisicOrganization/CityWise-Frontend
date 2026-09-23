import type { CouncilDistrict } from "./councilDistricts";
import { stripCsaPrefix, type CsaRow } from "./csaIndex";

/**
 * Left-panel readout of one council district's neighborhoods, so the district picture is visible
 * without clicking each polygon one at a time. Lives directly in the panel (see
 * `HomelessCountPage.tsx`), under the Layers section — always showing exactly one district's
 * rows, never a picker of its own. The page is locked to Council District 2 (see its
 * `DISTRICT`), so that is the only district this ever receives.
 *
 * CRITICAL, read before touching this file: this section prints NO summed total across its rows,
 * anywhere, for any reason, and that is deliberate, not an oversight. LAHSA's own service
 * metadata says, verbatim: "LAHSA does not recommend aggregating census tract-level data to
 * calculate numbers for other geographic levels." The legend elsewhere on this page already
 * carries a footnote about this; do not "fix" this section by adding a sum.
 *
 * Total_Pop for every row comes from the shipped static index (`csaIndex.ts` /
 * public/data/lahsa-2020-csa-index.json) — the only place all of a district's rows are known
 * regardless of the current map viewport. The unsheltered/sheltered split is NOT in that index;
 * it exists only in the Scout tiles, which expose only whichever features are currently loaded.
 * Rather than add a network fetch to fill that gap (explicitly out of scope), a row's split is
 * shown only when `liveAttributesByLabel` already has it — i.e. that CSA's tile feature happens
 * to be loaded — and omitted otherwise. No value here is ever fabricated or estimated.
 */
export interface CsaDistrictSummaryProps {
  district: CouncilDistrict;
  /** The full 304-row static index, used to look up each label's Total_Pop and display name. */
  rows: CsaRow[];
  /** Raw tile attributes, keyed by CSA_Label, for whichever of this district's CSAs currently
   * have a loaded tile feature. A label missing here just means its tile hasn't loaded — not
   * that the neighborhood has no data. */
  liveAttributesByLabel: Record<string, Record<string, unknown>>;
  /** Selects this neighborhood exactly as clicking its polygon would (opens the detail card,
   * triggers the orange highlight) — see `HomelessCountPage.tsx`'s `selectCsa`. */
  onSelectLabel: (label: string) => void;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const DISTRICT_SUMMARY_HEADING_ID = "homeless-count-district-summary-heading";

export function CsaDistrictSummary({
  district,
  rows,
  liveAttributesByLabel,
  onSelectLabel,
}: CsaDistrictSummaryProps) {
  return (
    <section
      className="homeless-count-district-summary"
      aria-labelledby={DISTRICT_SUMMARY_HEADING_ID}
    >
      <h2 id={DISTRICT_SUMMARY_HEADING_ID} className="homeless-count-panel-heading">
        {district.label}
      </h2>

      <ul className="homeless-count-district-summary-rows">
        {district.csaLabels.map((label) => {
          const row = rows.find((candidate) => candidate.CSA_Label === label);
          const displayName = row?.displayName ?? stripCsaPrefix(label);
          const live = liveAttributesByLabel[label];
          const unsheltered = readNumber(live?.Total_Unsheltered_Pop);
          const sheltered = readNumber(live?.Total_Sheltered_Pop);
          const hasSplit = unsheltered !== null && sheltered !== null;

          return (
            <li key={label}>
              <button
                type="button"
                className="homeless-count-district-summary-row"
                onClick={() => onSelectLabel(label)}
              >
                <span className="homeless-count-district-summary-name">{displayName}</span>
                <span className="homeless-count-district-summary-total">
                  {row ? row.Total_Pop.toLocaleString() : "—"}
                </span>
                {/* Omitted entirely (not a "—" placeholder) when this CSA's tile feature hasn't
                    loaded yet — a dash here would read as "counted zero", which is not what a
                    missing tile means. */}
                {hasSplit ? (
                  <span className="homeless-count-district-summary-split">
                    {unsheltered.toLocaleString()} unsheltered / {sheltered.toLocaleString()} sheltered
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {/* No sum of the rows above is rendered here, and none should ever be added — see this
          file's top-of-file comment for LAHSA's own guidance against aggregating this data. */}
    </section>
  );
}
