import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { usePostHog } from "@posthog/react";

import {
  isAddressWithinLosAngelesCity,
  searchAddressesWithLosAngelesCitySplit,
  type GeocodeSearchResult,
} from "../../shared/map/geocodeSearch";
import {
  geocodePrimaryLineParts,
  navigateToMapFromAddressSearch,
  splitGeocodeDisplayLines,
} from "../../shared/map/mapNavigateFromAddressSearch";
import { AppShell } from "../../shared/ui/AppShell";
import { SearchIcon } from "../../shared/ui/visicIcons";

import { LandingCommentBlue, LandingCommentGreen, LandingCommentGrey } from "./LandingCommentBubbles";

/** Pin positions as % of the hero (centered on each icon); tuned to sit on the map artwork. */
const LANDING_PINS = [
  { id: "pin-orange-1", src: "/images/pins/orange-pin.svg", left: 16.9, top: 62.5 },
  { id: "pin-orange-2", src: "/images/pins/orange-pin.svg", left: 88.1, top: 51.2 },
  { id: "pin-blue-1", src: "/images/pins/blue-pin.svg", left: 68.6, top: 82.2 },
  { id: "pin-blue-2", src: "/images/pins/blue-pin.svg", left: 76.1, top: 27.1 },
  { id: "pin-brown-1", src: "/images/pins/brown-pin.svg", left: 6.1, top: 76.3 },
  { id: "pin-brown-2", src: "/images/pins/brown-pin.svg", left: 45.4, top: 89.4 },
  { id: "pin-green-1", src: "/images/pins/green-pin.svg", left: 12.4, top: 24 },
  { id: "pin-green-2", src: "/images/pins/green-pin.svg", left: 85.3, top: 88.6 },
] as const;

const LANDING_ART_OPACITY = 0.22;
/** Pin opacity only (map uses LANDING_ART_OPACITY). Same file: `--landing-pin-opacity` on `.landing-hero`. */
const LANDING_PIN_OPACITY = 0.30;
const LANDING_ADDRESS_STORAGE_KEY = "citywise:landingAddressQuery";
const LANDING_SUGGESTIONS_LISTBOX_ID = "landing-address-suggestions";
const SUGGESTIONS_VIEWPORT_BOTTOM_GUTTER = 16;

type SuggestionsOverlayLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function LandingPage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);
  const [showOutOfCityTooltip, setShowOutOfCityTooltip] = useState(false);
  const [showOutOfCityModal, setShowOutOfCityModal] = useState(false);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const [suggestionsOverlay, setSuggestionsOverlay] = useState<SuggestionsOverlayLayout | null>(null);

  useEffect(() => {
    const storedQuery = window.localStorage.getItem(LANDING_ADDRESS_STORAGE_KEY);
    if (storedQuery) {
      setQuery(storedQuery);
    }
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      window.localStorage.setItem(LANDING_ADDRESS_STORAGE_KEY, trimmedQuery);
      return;
    }
    window.localStorage.removeItem(LANDING_ADDRESS_STORAGE_KEY);
  }, [query]);

  useEffect(() => {
    let ignore = false;

    if (!query.trim()) {
      setResults([]);
      setShowOutOfCityTooltip(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchAddressesWithLosAngelesCitySplit(query)
        .then(({ inLosAngelesCity, nominatimHitCount, nominatimResults }) => {
          if (!ignore) {
            setResults(nominatimResults);
            const outside =
              nominatimHitCount > 0 && inLosAngelesCity.length === 0;
            setShowOutOfCityTooltip(outside);
          }
        })
        .catch(() => {
          if (!ignore) {
            setResults([]);
            setShowOutOfCityTooltip(false);
          }
        });
    }, 180);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useLayoutEffect(() => {
    if (results.length === 0) {
      setSuggestionsOverlay(null);
      return undefined;
    }

    const updateOverlay = () => {
      const row = searchRowRef.current;
      if (!row) {
        return;
      }
      const r = row.getBoundingClientRect();
      const top = r.bottom + 6;
      const maxHeight = Math.max(
        120,
        window.innerHeight - top - SUGGESTIONS_VIEWPORT_BOTTOM_GUTTER,
      );
      setSuggestionsOverlay({
        top,
        left: r.left,
        width: r.width,
        maxHeight,
      });
    };

    updateOverlay();
    window.addEventListener("resize", updateOverlay);
    window.addEventListener("scroll", updateOverlay, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateOverlay);
    vv?.addEventListener("scroll", updateOverlay);
    return () => {
      window.removeEventListener("resize", updateOverlay);
      window.removeEventListener("scroll", updateOverlay, true);
      vv?.removeEventListener("resize", updateOverlay);
      vv?.removeEventListener("scroll", updateOverlay);
    };
  }, [results, query, showOutOfCityTooltip]);

  async function handleSelectLandingSuggestion(result: GeocodeSearchResult) {
    posthog?.capture("address_suggestion_selected", { label: result.label });
    const inCity = await isAddressWithinLosAngelesCity(result);
    if (!inCity) {
      setQuery(result.label);
      setShowOutOfCityTooltip(false);
      setShowOutOfCityModal(true);
      return;
    }
    setQuery(result.label);
    setShowOutOfCityTooltip(false);
    setShowOutOfCityModal(false);
    void navigateToMapFromAddressSearch(navigate, result.label, result);
  }

  async function handleSearch() {
    const trimmedQuery = query.trim();
    posthog?.capture("address_searched", { query: trimmedQuery, has_query: Boolean(trimmedQuery) });
    setShowOutOfCityTooltip(false);

    if (!trimmedQuery) {
      try {
        await navigateToMapFromAddressSearch(navigate, trimmedQuery);
      } catch {
        navigate("/map");
      }
      return;
    }

    let primaryInCity: GeocodeSearchResult | undefined;
    try {
      const { inLosAngelesCity, nominatimHitCount } =
        await searchAddressesWithLosAngelesCitySplit(trimmedQuery);
      primaryInCity = inLosAngelesCity[0];
      if (nominatimHitCount > 0 && inLosAngelesCity.length === 0) {
        setShowOutOfCityModal(true);
        return;
      }
    } catch {
      navigate("/map");
      return;
    }

    try {
      await navigateToMapFromAddressSearch(
        navigate,
        trimmedQuery,
        primaryInCity,
      );
    } catch {
      navigate("/map");
    }
  }

  const heroSurfaceStyle = {
    "--landing-art-opacity": LANDING_ART_OPACITY,
    "--landing-pin-opacity": LANDING_PIN_OPACITY,
  } as CSSProperties;

  return (
    <AppShell className="landing-shell">
      <section className="landing-hero" style={heroSurfaceStyle}>
        <div className="landing-map-layer" aria-hidden="true">
          <img
            className="landing-map-image"
            src="/images/landing/map-bg.png"
            alt=""
            decoding="async"
            onError={(event) => {
              event.currentTarget.src = "/images/map-bg.png";
            }}
          />
        </div>
        <div className="landing-hero-ellipse" aria-hidden="true">
          <img src="/images/landing/hero-ellipse.svg" alt="" />
        </div>
        <div className="landing-pins" aria-hidden="true">
          {LANDING_PINS.map((pin) => (
            <img
              key={pin.id}
              className="landing-pin"
              src={pin.src}
              alt=""
              style={
                {
                  "--pin-top": `${pin.top}%`,
                  "--pin-left": `${pin.left}%`,
                } as CSSProperties
              }
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ))}
        </div>
        <div className="landing-comments">
          <LandingCommentBlue>What district am I in?</LandingCommentBlue>
          <LandingCommentGrey>Who is my council member?</LandingCommentGrey>
          <LandingCommentGreen>{"What\u2019s happening in my district?"}</LandingCommentGreen>
        </div>

        <div className="landing-hero-content">
          <div className="landing-centerpiece">
            <h1>Visualize Your Council Member&apos;s Impact</h1>
            <p className="landing-tagline">
              CityWise simplifies confusing government data and projects to guide informed decisions.
            </p>

            <form
              className="landing-search"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearch();
              }}
            >
              <div ref={searchRowRef} className="landing-search-row">
                <div className="landing-search-field">
                  <span className="landing-search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setShowOutOfCityTooltip(false);
                      setShowOutOfCityModal(false);
                    }}
                    autoFocus
                    aria-label="Search address"
                    aria-expanded={results.length > 0}
                    aria-controls={results.length > 0 ? LANDING_SUGGESTIONS_LISTBOX_ID : undefined}
                    placeholder="Enter your address to search..."
                  />
                </div>
                <div className="landing-search-button-container">
                  <button type="submit" className="landing-search-button">
                    <span className="landing-search-button-text">Search</span>
                    <span className="landing-search-button-icon-wrap" aria-hidden="true">
                      <SearchIcon />
                    </span>
                  </button>
                  {showOutOfCityTooltip && (
                    <div className="landing-search-tooltip">
                      Entered address is not within the City of Los Angeles. Click Search to view full map.
                    </div>
                  )}
                </div>
              </div>
            </form>
            {results.length > 0 && suggestionsOverlay
              ? createPortal(
                  <div
                    id={LANDING_SUGGESTIONS_LISTBOX_ID}
                    className="landing-search-results landing-search-results--overlay"
                    role="listbox"
                    aria-label="Address search suggestions"
                    style={{
                      position: "fixed",
                      top: suggestionsOverlay.top,
                      left: suggestionsOverlay.left,
                      width: suggestionsOverlay.width,
                      maxHeight: suggestionsOverlay.maxHeight,
                    }}
                  >
                    {results.map((result) => {
                      const { primary, secondary } = splitGeocodeDisplayLines(result.label);
                      const { bold, rest } = geocodePrimaryLineParts(primary);
                      return (
                        <button
                          key={result.id}
                          type="button"
                          role="option"
                          aria-label={result.label}
                          className="landing-search-result-hit"
                          onClick={() => {
                            void handleSelectLandingSuggestion(result);
                          }}
                        >
                          <span className="landing-search-result-line1">
                            {bold ? (
                              <>
                                <span className="landing-search-result-bold">{bold}</span>
                                <span>{rest}</span>
                              </>
                            ) : (
                              primary
                            )}
                          </span>
                          {secondary ? (
                            <span className="landing-search-result-line2">{secondary}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>,
                  document.body,
                )
              : null}
            <p className="landing-search-subtitle">
              Only addresses within the City of Los Angeles are supported
            </p>
          </div>
        </div>
      </section>

      {showOutOfCityModal && (
        <div className="landing-modal-overlay" onClick={() => setShowOutOfCityModal(false)}>
          <div className="landing-modal" onClick={(e) => e.stopPropagation()}>
            <div className="landing-modal-content">
              <h2 className="landing-modal-title">Address Outside Los Angeles</h2>
              <p className="landing-modal-message">
                Entered address is not within the City of Los Angeles. Click Explore to view full map.
              </p>
              <div className="landing-modal-actions">
                <button
                  className="landing-modal-explore-button"
                  onClick={() => {
                    setShowOutOfCityModal(false);
                    navigate("/map");
                  }}
                >
                  Explore
                </button>
                <button
                  className="landing-modal-cancel-button"
                  onClick={() => setShowOutOfCityModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
