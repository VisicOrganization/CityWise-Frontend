import { DENSITY_LEGEND_STOPS } from "./csaLayers";

const LEGEND_HEADING_ID = "homeless-count-map-legend-heading";

/**
 * The choropleth's density key, on the map surface rather than in the left panel — a key is only
 * useful next to the thing it decodes.
 *
 * Deliberately built from the /map page's own filter markup and classes (`map-figma-flyout
 * --district-filter` card, `map-utility-header` heading, `map-district-filter-option` rows), the
 * same reuse `EncampmentMonthFilter` records, so this page's map chrome reads as one family.
 * Unlike those, it is always visible: there is no trigger and nothing to open — a key behind a
 * button is a key nobody reads.
 *
 * The footnotes and error messages that used to sit under this key stay in the left panel: they
 * are caveats to read once, not a lookup used while scanning the map.
 */
export function HomelessCountLegend() {
  return (
    <div className="homeless-count-map-legend">
      <section
        className="map-figma-flyout map-figma-flyout--district-filter"
        aria-labelledby={LEGEND_HEADING_ID}
      >
        <div className="map-utility-header">
          <strong id={LEGEND_HEADING_ID}>Homeless residents per sq. mile (2020)</strong>
        </div>
        <div className="map-neighborhood-legend">
          {DENSITY_LEGEND_STOPS.map((stop) => (
            // A row, not a `<label>` like /map's own legend: these rows toggle nothing.
            <div key={stop.label} className="map-district-filter-option">
              <span
                className="homeless-count-map-legend-swatch"
                style={{ backgroundColor: stop.color }}
                aria-hidden
              />
              <span className="map-neighborhood-legend-label">{stop.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
