import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  applyMapSearchParamsFromAddress,
  geocodePrimaryLineParts,
  splitGeocodeDisplayLines,
} from "../../shared/map/mapNavigateFromAddressSearch";
import { searchAddresses, type GeocodeSearchResult } from "../../shared/map/geocodeSearch";

interface MapAddressSearchProps {
  /** Increment when the map background is clicked so the expanded search closes. */
  dismissSignal: number;
}

export function MapAddressSearch({ dismissSignal }: MapAddressSearchProps) {
  const [, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);

  useEffect(() => {
    if (dismissSignal === 0) {
      return;
    }
    setExpanded(false);
  }, [dismissSignal]);

  useEffect(() => {
    let ignore = false;

    if (!expanded || !query.trim()) {
      setResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchAddresses(query)
        .then((nextResults) => {
          if (!ignore) {
            setResults(nextResults);
          }
        })
        .catch(() => {
          if (!ignore) {
            setResults([]);
          }
        });
    }, 180);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [expanded, query]);

  async function runSearch(selected?: GeocodeSearchResult) {
    const labelForParams = selected ? selected.label : query.trim();
    try {
      await applyMapSearchParamsFromAddress(setSearchParams, labelForParams, selected);
    } catch {
      /* Nominatim or boundaries lookup may fail; still collapse the panel. */
    }
    setExpanded(false);
  }

  return (
    <div className={`map-address-search ${expanded ? "is-expanded" : "is-collapsed"}`}>
      {expanded ? (
        <form
          className="map-address-search-expanded"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <div className="map-address-search-bar">
            <span className="map-address-search-bar-icon" aria-hidden="true">
              <img src="/search-icon.svg" alt="" width={18} height={18} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search address"
              placeholder="Enter your address to search..."
              autoFocus
            />
          </div>
          {results.length > 0 ? (
            <div className="map-address-search-dropdown" role="listbox" aria-label="Address search results">
              {results.map((result) => {
                const { primary, secondary } = splitGeocodeDisplayLines(result.label);
                const { bold, rest } = geocodePrimaryLineParts(primary);
                return (
                  <button
                    key={result.id}
                    type="button"
                    className="map-address-search-hit"
                    role="option"
                    onClick={() => {
                      setQuery(result.label);
                      void runSearch(result);
                    }}
                  >
                    <p className="map-address-search-hit-line1">
                      {bold ? (
                        <>
                          <span className="map-address-search-hit-bold">{bold}</span>
                          <span>{rest}</span>
                        </>
                      ) : (
                        primary
                      )}
                    </p>
                    {secondary ? <p className="map-address-search-hit-line2">{secondary}</p> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          className="map-address-search-collapsed"
          aria-label="Open address search"
          onClick={() => setExpanded(true)}
        >
          <img src="/search-icon.svg" alt="" width={18} height={18} />
        </button>
      )}
    </div>
  );
}
