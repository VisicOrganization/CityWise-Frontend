import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppShell } from "../components/shell/AppShell";
import { landingPrompts } from "../lib/mock/mapDemo";


export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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

          <div className="landing-search">
            <span className="landing-search-icon">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search address"
              placeholder="Enter your address to search..."
            />
            <button type="button" className="landing-search-button" onClick={handleSearch}>
              Search
            </button>
          </div>

          <div className="landing-links">
            <Link to="/map">Search by district</Link>
            <Link to="/map">Search by council member</Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
