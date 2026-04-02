import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { searchDemoAddresses, type DemoGeocodeResult } from "../../shared/mock/demoGeocoding";
import { landingPrompts } from "../../shared/mock/mapDemo";
import { AppShell } from "../../shared/ui/AppShell";
import { SearchIcon } from "../../shared/ui/visicIcons";


export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DemoGeocodeResult[]>([]);

  useEffect(() => {
    let ignore = false;

    if (!query.trim()) {
      setResults([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void searchDemoAddresses(query)
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

  function handleSearch() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      navigate("/map");
      return;
    }

    navigate(`/map?q=${encodeURIComponent(trimmedQuery)}`);
  }

  return (
    <AppShell className="landing-shell">
      <section className="landing-hero">
        <div className="landing-prompt landing-prompt-left">{landingPrompts[0].label}</div>
        <div className="landing-prompt landing-prompt-right">{landingPrompts[1].label}</div>
        <div className="landing-prompt landing-prompt-bottom">{landingPrompts[2].label}</div>

        <div className="landing-centerpiece">
          <h1>Visualize Your Council Member&apos;s Impact</h1>
          <p>
            CityWise simplifies confusing government data and projects to guide informed decisions.
          </p>

          <form
            className="landing-search"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
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
                      navigate(`/map?q=${encodeURIComponent(result.label)}`);
                    }}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div className="landing-links">
            <Link to="/map">Search by district</Link>
            <Link to="/map">Search by council member</Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
