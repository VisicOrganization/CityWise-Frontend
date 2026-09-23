import { useCallback, useEffect, useRef, useState } from "react";

const INFO_PANEL_ID = "homeless-count-map-info-panel";
const INFO_PANEL_TITLE_ID = "homeless-count-map-info-title";

/**
 * Top-right orientation panel for the map surface.
 *
 * Placement: the map is rendered with react-map-gl's defaults, so the only MapLibre chrome on it
 * is the attribution control (bottom-right) and the MapLibre logo (bottom-left) — no
 * `NavigationControl`, `ScaleControl` or `GeolocateControl` is mounted anywhere in
 * `HomelessCountPage.tsx`. Top-right is therefore free of MapLibre chrome (the page's own month
 * filter sits under this panel's button), and the panel is positioned against
 * `.homeless-count-map-wrap` (already `position: relative`) rather than over the left panel.
 *
 * Audience is a council staffer, not an engineer: no tile URLs, no zoom levels, no source-layer
 * names. That detail lives in the left panel's "Data sources" section, which is the reference
 * surface; this is the orientation surface.
 */
export function MapInfoPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** Single close path, so focus always lands back on the trigger — Escape, the close button and
   * a second click on the trigger all go through here. */
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Moves focus into the panel on open so a keyboard user lands on its close button rather than
  // having to tab past the whole map to reach it.
  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="homeless-count-map-info">
      <button
        ref={triggerRef}
        type="button"
        className="homeless-count-map-info-btn"
        aria-expanded={isOpen}
        aria-controls={INFO_PANEL_ID}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        {/* The visible text IS the accessible name (WCAG 2.5.3), so no aria-label overriding it
            with something a speech-input user cannot say. The glyph is decorative. */}
        <span aria-hidden="true" className="homeless-count-map-info-glyph">
          i
        </span>
        Info
      </button>

      {isOpen ? (
        <section
          id={INFO_PANEL_ID}
          className="homeless-count-map-info-panel"
          role="region"
          aria-labelledby={INFO_PANEL_TITLE_ID}
        >
          <div className="homeless-count-map-info-head">
            <h2 id={INFO_PANEL_TITLE_ID} className="homeless-count-map-info-title">
              About this map
            </h2>
            <button
              ref={closeRef}
              type="button"
              className="homeless-count-map-info-close"
              onClick={close}
              aria-label="Close about this map"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="homeless-count-map-info-body">
            <p>
              This is the 2020 Point-in-Time count — a single night’s count of people experiencing
              homelessness — shown by statistical area, focused on Council District 2.
            </p>

            <h3 className="homeless-count-map-info-subhead">The shaded areas</h3>
            <p>
              Darker shading means more people per square mile, not a bigger headcount. Statistical
              areas vary enormously in size, so raw counts would make large, sparsely affected areas
              look like the worst ones. Each area’s own numbers are in its card when you click it.
            </p>
            <p>
              These areas come from the Los Angeles Homeless Services Authority (LAHSA), published
              through LA County’s GIS. LAHSA asks that these figures not be added together across
              areas, so this page never shows a district-wide total.
            </p>

            <h3 className="homeless-count-map-info-subhead">The blue dots</h3>
            <p>
              Shelters and service locations, from the county’s homeless shelters and services
              dataset. Click one for its details. Zoom in to see all of them.
            </p>

            <h3 className="homeless-count-map-info-subhead">The dashed outline</h3>
            <p>
              The actual Council District 2 boundary, from the City of Los Angeles council district
              file. It is worth knowing that it does not follow the shaded areas: the count is
              reported by statistical area, and those areas were never drawn to match council
              districts.
            </p>

            <h3 className="homeless-count-map-info-subhead">The streets underneath</h3>
            <p>
              A standard basemap from CARTO, built on OpenStreetMap. It carries no count data.
            </p>

            <p className="homeless-count-map-info-footnote">
              Exact datasets, files and caveats are listed under “Data sources” in the left panel.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
