import { useEffect, useMemo, useRef, useState } from "react";

import { buildHiddenForDistrict, COUNCIL_DISTRICTS, type CouncilDistrict } from "./councilDistricts";
import { filterCsaRows, groupCsaRows, type CsaRow } from "./csaIndex";

const CSA_FILTER_HEADING_ID = "homeless-count-filter-heading";

/**
 * Copied verbatim from `CityMap.tsx` — `indeterminate` is a DOM property with no JSX
 * attribute, so it has to be written through a ref. Stateless shim, nothing to drift.
 */
function TristateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />;
}

interface CsaFilterSectionProps {
  /** All 304 neighborhoods, unsorted. Grouping and sorting happen here. */
  rows: CsaRow[];
  /** Labels the map should hide. A row is CHECKED iff its label is *not* in this set. */
  hiddenLabels: Set<string>;
  onHiddenChange: (next: Set<string>) => void;
  /** Called (in addition to `onHiddenChange`) when a council district preset button is clicked,
   * so the page can move the map to that district. Not called for Select all / Clear all. */
  onSelectDistrict: (district: CouncilDistrict) => void;
}

/**
 * Always-visible neighborhood filter, living directly in the left-hand panel (see
 * `HomelessCountPage.tsx`). This used to be `CsaFilterDropdown`, a click-to-open portaled
 * popover — inside a persistent panel there is no trigger to click and nothing to portal, so all
 * of that machinery (portal render, viewport-relative positioning, outside-click / Escape
 * dismissal, the trigger button) was deleted rather than merely stopped from being called. The
 * one thing carried over unchanged is the count readout that used to live in the trigger label;
 * it is now this section's `<h2>`.
 */
export function CsaFilterSection({
  rows,
  hiddenLabels,
  onHiddenChange,
  onSelectDistrict,
}: CsaFilterSectionProps) {
  const [query, setQuery] = useState("");

  // No debounce: 304 in-memory strings filter instantly, so a timer would only add lag.
  const groups = useMemo(() => groupCsaRows(filterCsaRows(rows, query)), [rows, query]);
  const matchCount = groups.reduce((total, group) => total + group.rows.length, 0);

  const hiddenCount = hiddenLabels.size;
  const countHeading =
    hiddenCount === 0
      ? `All ${rows.length} neighborhoods`
      : hiddenCount >= rows.length
        ? "No neighborhoods"
        : `${rows.length - hiddenCount} of ${rows.length} neighborhoods`;

  function toggleRow(label: string) {
    const next = new Set(hiddenLabels);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    onHiddenChange(next);
  }

  /**
   * A group header toggles only the rows currently *visible* in that section — i.e. the
   * search-filtered subset, not the whole family. Searching "park" then clearing the
   * Los Angeles header hides the matched parks and leaves the other 130 LA rows alone.
   */
  function toggleGroup(groupRows: CsaRow[], allChecked: boolean) {
    const next = new Set(hiddenLabels);
    for (const row of groupRows) {
      if (allChecked) {
        next.add(row.CSA_Label);
      } else {
        next.delete(row.CSA_Label);
      }
    }
    onHiddenChange(next);
  }

  return (
    <section className="homeless-count-filter-section" aria-labelledby={CSA_FILTER_HEADING_ID}>
      <h2 id={CSA_FILTER_HEADING_ID} className="homeless-count-panel-heading">
        {countHeading}
      </h2>

      <input
        type="search"
        className="homeless-count-filter-search"
        placeholder="Filter neighborhoods"
        aria-label="Filter neighborhoods"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/*
        A plain action button, not a stateful select: the resulting filter can be edited
        afterward by checkbox, so a persistent "active district" value would go stale.
      */}
      <div className="homeless-count-district-actions" role="group" aria-label="Council district shortcuts">
        {COUNCIL_DISTRICTS.map((district) => (
          <button
            key={district.id}
            type="button"
            className="homeless-count-district-btn"
            onClick={() => {
              onHiddenChange(buildHiddenForDistrict(rows, district));
              onSelectDistrict(district);
            }}
          >
            {district.label}
          </button>
        ))}
      </div>

      {/* Unlike the group headers, these two always act on all rows, not the search subset. */}
      <div className="map-district-filter-actions" role="group" aria-label="Neighborhood filter quick actions">
        <button
          type="button"
          className="map-district-filter-action-btn"
          onClick={() => onHiddenChange(new Set<string>())}
        >
          Select all
        </button>
        <button
          type="button"
          className="map-district-filter-action-btn"
          onClick={() => onHiddenChange(new Set(rows.map((row) => row.CSA_Label)))}
        >
          Clear all
        </button>
      </div>

      <div className="homeless-count-filter-list">
        {matchCount === 0 ? (
          <p className="homeless-count-filter-empty">No neighborhoods match “{query}”.</p>
        ) : null}

        {groups.map((group) => {
          if (group.rows.length === 0) {
            return null;
          }
          const checkedCount = group.rows.filter((row) => !hiddenLabels.has(row.CSA_Label)).length;
          const allChecked = checkedCount === group.rows.length;
          return (
            <section key={group.key} className="homeless-count-filter-group">
              <label className="map-district-filter-option homeless-count-filter-group-head">
                <TristateCheckbox
                  checked={allChecked}
                  indeterminate={checkedCount > 0 && !allChecked}
                  onChange={() => toggleGroup(group.rows, allChecked)}
                />
                <span className="homeless-count-filter-group-title">{group.title}</span>
                <span className="homeless-count-filter-count">{group.rows.length}</span>
              </label>
              <div className="homeless-count-filter-rows">
                {group.rows.map((row) => (
                  <label key={row.CSA_Label} className="map-district-filter-option homeless-count-filter-row">
                    <input
                      type="checkbox"
                      // 10 stripped names repeat across groups; the full label disambiguates.
                      aria-label={row.CSA_Label}
                      checked={!hiddenLabels.has(row.CSA_Label)}
                      onChange={() => toggleRow(row.CSA_Label)}
                    />
                    <span className="homeless-count-filter-name">{row.displayName}</span>
                    <span className="homeless-count-filter-count">{row.Total_Pop.toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
