import { useState } from "react";

import type { MonthOption } from "./encampmentLayers";

/**
 * "Month filed" filter for the 311 encampment reports layer, on the right edge of the map.
 *
 * Deliberately built from the /map page's own filter markup and classes (`CityMap.tsx`'s
 * "District filters" flyout: `map-control-pill--tools` trigger, `map-figma-flyout--district-filter`
 * panel, `map-district-filter-*` actions and options) rather than restyled here, so the two filters
 * look and behave the same and a change to one lands on both.
 *
 * The page owns the state as a set of *hidden* months, so "nothing hidden" is the default without
 * the page needing to know which months exist before the data loads.
 */
export interface EncampmentMonthFilterProps {
  options: MonthOption[];
  hiddenMonths: ReadonlySet<string>;
  onHiddenMonthsChange: (next: Set<string>) => void;
}

export function EncampmentMonthFilter({ options, hiddenMonths, onHiddenMonthsChange }: EncampmentMonthFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const shown = options.reduce((sum, option) => sum + (hiddenMonths.has(option.key) ? 0 : option.count), 0);

  function toggle(key: string) {
    const next = new Set(hiddenMonths);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onHiddenMonthsChange(next);
  }

  return (
    <div className="homeless-count-map-filter">
      <div className="map-figma-controls-wrap">
        <div className="map-control-pill map-control-pill--stacked map-control-pill--tools">
          <button
            type="button"
            className={`map-figma-ctrl-btn map-figma-ctrl-btn--expandable ${isOpen ? "is-active" : ""}`}
            aria-label="Filter encampment reports by month filed"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="map-figma-ctrl-btn-label">Filter</span>
            {/* Same funnel glyph as the /map Filter button. */}
            <svg
              className="map-figma-ctrl-icon"
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3.38589 5.66687C2.62955 4.82155 2.25138 4.39889 2.23712 4.03968C2.22473 3.72764 2.35882 3.42772 2.59963 3.22889C2.87684 3 3.44399 3 4.57828 3H19.4212C20.5555 3 21.1227 3 21.3999 3.22889C21.6407 3.42772 21.7748 3.72764 21.7624 4.03968C21.7481 4.39889 21.3699 4.82155 20.6136 5.66687L14.9074 12.0444C14.7566 12.2129 14.6812 12.2972 14.6275 12.3931C14.5798 12.4781 14.5448 12.5697 14.5236 12.6648C14.4997 12.7721 14.4997 12.8852 14.4997 13.1113V18.4584C14.4997 18.6539 14.4997 18.7517 14.4682 18.8363C14.4403 18.911 14.395 18.9779 14.336 19.0315C14.2692 19.0922 14.1784 19.1285 13.9969 19.2012L10.5969 20.5612C10.2293 20.7082 10.0455 20.7817 9.89802 20.751C9.76901 20.7242 9.6558 20.6476 9.583 20.5377C9.49975 20.4122 9.49975 20.2142 9.49975 19.8184V13.1113C9.49975 12.8852 9.49975 12.7721 9.47587 12.6648C9.45469 12.5697 9.41971 12.4781 9.37204 12.3931C9.31828 12.2972 9.2429 12.2129 9.09213 12.0444L3.38589 5.66687Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isOpen ? (
          <div
            className="map-figma-flyout map-figma-flyout--district-filter"
            role="group"
            aria-label="Encampment report filters"
          >
            <div className="map-utility-header">
              <strong>Month filed</strong>
              <button
                type="button"
                className="map-flyout-close-btn"
                aria-label="Close month filter"
                onClick={() => setIsOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <p>Select the months of 2026 to show 311 encampment reports from.</p>
            <div className="map-district-filter-actions" role="group" aria-label="Month filter quick actions">
              <button
                type="button"
                className="map-district-filter-action-btn"
                onClick={() => onHiddenMonthsChange(new Set())}
              >
                Select all
              </button>
              <button
                type="button"
                className="map-district-filter-action-btn"
                onClick={() => onHiddenMonthsChange(new Set(options.map((option) => option.key)))}
              >
                Deselect all
              </button>
            </div>
            <div className="map-district-filter-grid">
              {options.map((option) => (
                <label key={option.key} className="map-district-filter-option">
                  <input
                    type="checkbox"
                    checked={!hiddenMonths.has(option.key)}
                    onChange={() => toggle(option.key)}
                  />
                  <span>{option.label}</span>
                  <span className="map-neighborhood-legend-count">{option.count}</span>
                </label>
              ))}
            </div>
            <p className="map-neighborhood-legend-note" role="status">
              Showing {shown.toLocaleString()} of {total.toLocaleString()} reports.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
