import { ResourceCard } from "../map/ResourceDetailPanel";
import { getPanelSourceUrl, resolvePanelSelection, type NeighborhoodCollection, type PanelAsset } from "../map/cd2Assets";
import type { ResourceResult } from "./useNeighborhoodChat";

export function NeighborhoodResults({ result, neighborhoods, onSelect, onClose }: {
  result: ResourceResult; neighborhoods: NeighborhoodCollection; onSelect: (asset: PanelAsset) => void; onClose: () => void;
}) {
  return <aside className="nc-results" aria-label="Matching neighborhood resources">
    <header><div><p className="nc-eyebrow">Neighborhood chat results</p><h2>{result.items.length} matching resources</h2></div>
      <button type="button" aria-label="Close resource results" onClick={onClose}>×</button></header>
    <div className="nc-results-scroll">
      {!result.items.length ? <p>No matching resources are recorded in these listings.</p> : null}
      <ul className="neighborhood-detail-cards">{result.items.map((item) => {
        const selection = resolvePanelSelection(item.properties, null);
        const source = selection ? getPanelSourceUrl(neighborhoods, selection) : null;
        return <li key={item.key} className="nc-result-group">
          <div className="nc-result-meta"><span>{item.properties.neighborhood}</span>
            {result.distances[item.key] != null ? <span>Approx. {result.distances[item.key].toFixed(1)} mi straight-line</span> : null}
            {item.properties.council_district !== 2 ? <span>Located {item.properties.council_district ? `in CD${item.properties.council_district}` : "outside CD2"}; listed for CD2</span> : null}
          </div>
          <ul><ResourceCard item={item} isFlashing={false} onSelect={onSelect} registerRef={() => {}} /></ul>
          {source ? <a className="nc-source" href={source} target="_blank" rel="noreferrer noopener">Official resource listing ↗</a> : null}
        </li>;
      })}</ul>
    </div>
  </aside>;
}
