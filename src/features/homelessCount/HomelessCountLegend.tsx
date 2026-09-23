import { DENSITY_LEGEND_STOPS } from "./csaLayers";

const LEGEND_HEADING_ID = "homeless-count-map-legend-heading";

/**
 * The choropleth's density key, on the map surface rather than in the left panel — a key is only
 * useful next to the thing it decodes.
 *
 * Deliberately built from the /map page's own filter markup and classes (`map-figma-flyout
 * --district-filter` card, `map-utility-header` heading, `map-district-filter-option` rows), the
 * same reuse `EncampmentMonthFilter` records, so this page's map chrome reads as one family.
 * Unlike those, there is no trigger and nothing to open — a key behind a button is a key nobody
 * reads; the page mounts it whenever the choropleth it decodes is drawn.
 *
 * The visual borrowing stops at the semantics: the title is an `<h2>` and the rows a list, as
 * they were in the left panel, so the key keeps its place in the heading outline and is still
 * announced as six items. /map's flyout labels are `<strong>`s inside a trigger-owned panel;
 * this is a standing section of the page.
 *
 * The footnotes and error messages that used to sit under this key stay in the left panel: they
 * are caveats to read once, not a lookup used while scanning the map.
 */
export function HomelessCountLegend() {
  return (
    <section
      className="homeless-count-map-legend map-figma-flyout map-figma-flyout--district-filter"
      aria-labelledby={LEGEND_HEADING_ID}
    >
      <div className="map-utility-header">
        <h2 id={LEGEND_HEADING_ID}>Homeless residents per sq. mile (2020)</h2>
      </div>
      {/* `role="list"` because the CSS drops the bullets, which drops list semantics in
          VoiceOver/Safari along with them. */}
      <ul className="map-neighborhood-legend" role="list">
        {DENSITY_LEGEND_STOPS.map((stop) => (
          // A row, not a `<label>` like /map's own legend: these rows toggle nothing.
          <li key={stop.label} className="map-district-filter-option">
            <span
              className="homeless-count-map-legend-swatch"
              style={{ backgroundColor: stop.color }}
              aria-hidden
            />
            <span className="map-neighborhood-legend-label">{stop.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
