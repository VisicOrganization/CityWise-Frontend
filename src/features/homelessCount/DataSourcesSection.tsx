import { DATA_SOURCES, type DataSourceToggleKey } from "./dataSources";

const DATA_SOURCES_HEADING_ID = "homeless-count-data-sources-heading";

interface DataSourcesSectionProps {
  /** Live state of the four layer toggles, owned by the "Layers" section above. */
  layerState: Record<DataSourceToggleKey, boolean>;
}

/**
 * Reference documentation for every dataset this page draws from, below the legend because it is
 * reference material rather than a primary control.
 *
 * **This section does not own any toggle state.** The "Layers" section at the top of the panel
 * stays the single control surface; each map-layer entry here only *reflects* whether its layer
 * is currently drawn. Two checkboxes for one layer is the failure mode to avoid, and reflecting
 * one piece of React state makes disagreement structurally impossible rather than merely
 * unlikely. It also keeps the control where a control belongs — at the top of the panel, next to
 * the color swatch that doubles as the key — instead of buried under the legend.
 *
 * Each entry is a native `<details>`: no custom accordion JS, and the `<summary>` deliberately
 * carries both the dataset name and its origin, so collapsing an entry hides the *detail* and
 * never hides *where the data comes from*.
 */
export function DataSourcesSection({ layerState }: DataSourcesSectionProps) {
  return (
    <section className="homeless-count-data-sources" aria-labelledby={DATA_SOURCES_HEADING_ID}>
      <h2 id={DATA_SOURCES_HEADING_ID} className="homeless-count-panel-heading">
        Data sources
      </h2>
      <p className="homeless-count-data-sources-hint">
        Show and hide layers in “Layers”, at the top of this panel.
      </p>

      <div className="homeless-count-data-source-list">
        {DATA_SOURCES.map((entry) => {
          const isLayer = entry.toggleKey !== null;
          const isShown = entry.toggleKey ? layerState[entry.toggleKey] : false;
          return (
            <details key={entry.id} className="homeless-count-data-source">
              <summary className="homeless-count-data-source-summary">
                <span className="homeless-count-data-source-name">{entry.name}</span>
                {/* Text, not a colored dot: this is the one place a reader checks what is
                    actually on the map, and it must survive being read aloud or printed. */}
                <span
                  className={
                    isLayer
                      ? `homeless-count-data-source-state homeless-count-data-source-state--${isShown ? "on" : "off"}`
                      : "homeless-count-data-source-state homeless-count-data-source-state--static"
                  }
                >
                  {isLayer ? (isShown ? "Shown" : "Hidden") : entry.staticReason}
                </span>
                <span className="homeless-count-data-source-origin">{entry.origin}</span>
              </summary>
              <div className="homeless-count-data-source-body">
                <p className="homeless-count-data-source-describes">{entry.describes}</p>
                <ul className="homeless-count-data-source-notes">
                  {entry.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
