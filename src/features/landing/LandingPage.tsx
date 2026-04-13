import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { searchAddresses, type GeocodeSearchResult } from "../../shared/map/geocodeSearch";
import { navigateToMapFromAddressSearch } from "../../shared/map/mapNavigateFromAddressSearch";
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

export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeSearchResult[]>([]);

  useEffect(() => {
    let ignore = false;

    if (!query.trim()) {
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
  }, [query]);

  async function handleSearch() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      navigate("/map");
      return;
    }

    try {
      await navigateToMapFromAddressSearch(navigate, trimmedQuery);
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
              <div className="landing-search-field">
                <span className="landing-search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search address"
                  placeholder="Enter your address to search..."
                />
              </div>
              <button type="submit" className="landing-search-button">
                <span className="landing-search-button-text">Search</span>
                <span className="landing-search-button-icon-wrap" aria-hidden="true">
                  <SearchIcon />
                </span>
              </button>
              {results.length > 0 ? (
                <div className="landing-search-results" role="listbox" aria-label="Landing search results">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setQuery(result.label);
                        void navigateToMapFromAddressSearch(navigate, result.label, result);
                      }}
                    >
                      {result.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
