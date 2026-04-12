import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { searchAddresses, type GeocodeSearchResult } from "../../shared/map/geocodeSearch";
import { findDistrictIdForPoint, loadDistrictBoundaries } from "../../shared/map/districtBoundaries";
import { AppShell } from "../../shared/ui/AppShell";
import { SearchIcon } from "../../shared/ui/visicIcons";

import { LandingCommentBlue, LandingCommentGreen, LandingCommentGrey } from "./LandingCommentBubbles";

const landingPinAssets = [
  "/images/pins/blue-pin.svg",
  "/images/pins/brown-pin.svg",
  "/images/pins/green-pin.svg",
  "/images/pins/orange-pin.svg",
];

type LandingPin = {
  id: string;
  src: string;
  top: number;
  left: number;
  size: number;
  rotation: number;
  opacity: number;
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function generateLandingPins(count: number, seed: number) {
  const random = createSeededRandom(seed);
  const pins: LandingPin[] = [];
  let attempts = 0;
  const maxAttempts = count * 200;

  while (pins.length < count && attempts < maxAttempts) {
    attempts += 1;
    const top = 8 + random() * 84;
    const left = 4 + random() * 92;

    const inCenterSafeZone = top >= 28 && top <= 70 && left >= 24 && left <= 76;
    if (inCenterSafeZone) {
      continue;
    }

    const src = landingPinAssets[Math.floor(random() * landingPinAssets.length)] ?? landingPinAssets[0];
    const size = 20 + random() * 20;
    const overlapsExistingPin = pins.some((existingPin) => {
      const deltaX = left - existingPin.left;
      const deltaY = top - existingPin.top;
      const distance = Math.hypot(deltaX, deltaY);
      const minAllowedDistance = ((size + existingPin.size) / 2) * 0.7;
      return distance < minAllowedDistance;
    });

    if (overlapsExistingPin) {
      continue;
    }

    pins.push({
      id: `landing-pin-${pins.length}`,
      src,
      top,
      left,
      size,
      rotation: -14 + random() * 28,
      opacity: 0.18 + random() * 0.2,
    });
  }

  return pins;
}

const desktopPins = generateLandingPins(18, 20260409);
const mobilePins = generateLandingPins(10, 20260410);

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

  async function navigateToMapWithDistrict(queryLabel: string, selectedResult?: GeocodeSearchResult) {
    const trimmedQuery = queryLabel.trim();
    if (!trimmedQuery) {
      navigate("/map");
      return;
    }

    let primaryResult = selectedResult;
    if (!primaryResult) {
      const nextResults = await searchAddresses(trimmedQuery);
      primaryResult = nextResults[0];
    }

    const nextParams = new URLSearchParams();

    if (primaryResult) {
      nextParams.set("focusLat", String(primaryResult.latitude));
      nextParams.set("focusLng", String(primaryResult.longitude));
      try {
        const boundaries = await loadDistrictBoundaries();
        const districtId = findDistrictIdForPoint(boundaries, primaryResult.longitude, primaryResult.latitude);
        if (districtId !== null) {
          nextParams.set("districtFocus", String(districtId));
          nextParams.set("showDistrictProfile", "1");
        }
      } catch {
        // Keep search flow resilient when boundaries lookup fails.
      }
    }

    navigate(`/map?${nextParams.toString()}`);
  }

  async function handleSearch() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      navigate("/map");
      return;
    }

    try {
      await navigateToMapWithDistrict(trimmedQuery);
    } catch {
      navigate("/map");
    }
  }

  return (
    <AppShell className="landing-shell">
      <section className="landing-hero">
        <div className="landing-pins" aria-hidden="true">
          {desktopPins.map((pin) => (
            <img
              key={pin.id}
              className="landing-pin landing-pin-desktop"
              src={pin.src}
              alt=""
              style={
                {
                  "--pin-top": `${pin.top}%`,
                  "--pin-left": `${pin.left}%`,
                  "--pin-size": `${pin.size}px`,
                  "--pin-rotation": `${pin.rotation}deg`,
                  "--pin-opacity": pin.opacity,
                } as CSSProperties
              }
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ))}
          {mobilePins.map((pin) => (
            <img
              key={`${pin.id}-mobile`}
              className="landing-pin landing-pin-mobile"
              src={pin.src}
              alt=""
              style={
                {
                  "--pin-top": `${pin.top}%`,
                  "--pin-left": `${pin.left}%`,
                  "--pin-size": `${pin.size * 0.86}px`,
                  "--pin-rotation": `${pin.rotation}deg`,
                  "--pin-opacity": Math.max(0.12, pin.opacity - 0.08),
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

        <div className="landing-centerpiece">
          <h1>Visualize Your Council Member&apos;s Impact</h1>
          <p>
            CityWise simplifies confusing government data and projects to guide informed decisions.
          </p>

          <form
            className="landing-search"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch();
            }}
          >
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
            <button type="submit" className="landing-search-button">
              Search
            </button>
            {results.length > 0 ? (
              <div className="landing-search-results" role="listbox" aria-label="Landing search results">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setQuery(result.label);
                      void navigateToMapWithDistrict(result.label, result);
                    }}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          {/* <div className="landing-links">
            <Link to="/map">Search by district</Link>
            <Link to="/map">Search by council member</Link>
          </div> */}
        </div>
      </section>
    </AppShell>
  );
}
