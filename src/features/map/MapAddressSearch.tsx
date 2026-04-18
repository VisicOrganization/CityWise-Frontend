import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePostHog } from "@posthog/react";

import {
  applyMapSearchParamsFromAddress,
  geocodePrimaryLineParts,
  splitGeocodeDisplayLines,
} from "../../shared/map/mapNavigateFromAddressSearch";
import {
  isAddressWithinLosAngelesCity,
  searchAddressesWithLosAngelesCitySplit,
  searchAddressesWithoutCityFilter,
  type GeocodeSearchResult,
} from "../../shared/map/geocodeSearch";

interface MapAddressSearchProps {
  /** Increment when the map background is clicked so the expanded search closes. */
  dismissSignal: number;
  /** Emits whether the search UI is currently expanded. */
  onExpandedChange?: (expanded: boolean) => void;
}

export function MapAddressSearch({ dismissSignal, onExpandedChange }: MapAddressSearchProps) {
  const [, setSearchParams] = useSearchParams();
  const posthog = usePostHog();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);
  const [showOutOfCityWarning, setShowOutOfCityWarning] = useState(false);

  useEffect(() => {
    if (dismissSignal === 0) {
      return;
    }
    setExpanded(false);
    setShowOutOfCityWarning(false);
  }, [dismissSignal]);

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    let ignore = false;

    if (!expanded || !query.trim()) {
      setResults([]);
      setShowOutOfCityWarning(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchAddressesWithLosAngelesCitySplit(query)
        .then(({ nominatimResults }) => {
          if (!ignore) {
            setResults(nominatimResults);
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
    setShowOutOfCityWarning(false);
    if (selected) {
      const inCity = await isAddressWithinLosAngelesCity(selected);
      if (!inCity) {
        setShowOutOfCityWarning(true);
        return;
      }
    }
    let resultForNavigation = selected;
    let shouldKeepExpanded = false;
    if (!selected) {
      posthog?.capture("map_address_searched", { query: labelForParams });
      const nextResults = await searchAddressesWithoutCityFilter(labelForParams);
      resultForNavigation = nextResults[0];
      if (resultForNavigation) {
        const isWithinLosAngeles = await isAddressWithinLosAngelesCity(resultForNavigation);
        shouldKeepExpanded = !isWithinLosAngeles;
        setShowOutOfCityWarning(shouldKeepExpanded);
      }
    }
    try {
      await applyMapSearchParamsFromAddress(setSearchParams, labelForParams, resultForNavigation);
    } catch {
      /* Nominatim or boundaries lookup may fail; still collapse the panel. */
    }
    if (!shouldKeepExpanded) {
      setExpanded(false);
    }
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
              onChange={(event) => {
                setQuery(event.target.value);
                setShowOutOfCityWarning(false);
              }}
              aria-label="Search address"
              placeholder="Enter your address to search..."
              autoFocus
            />
          </div>
          <p className="map-address-search-subtitle">
            Only addresses within the City of Los Angeles are supported
          </p>
          {showOutOfCityWarning ? (
            <p className="map-address-search-warning" role="status">
              Only addresses within LA city are allowed
            </p>
          ) : null}
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
                      posthog?.capture("map_address_suggestion_selected", { label: result.label });
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
