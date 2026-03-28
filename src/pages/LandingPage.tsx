import { Link } from "react-router-dom";

import { AppShell } from "../components/shell/AppShell";
import { landingPrompts } from "../lib/mock/mapDemo";


export function LandingPage() {
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
            <input type="text" readOnly value="Enter your address to search..." aria-label="Search address" />
            <Link to="/map" className="landing-search-button">
              Search
            </Link>
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
