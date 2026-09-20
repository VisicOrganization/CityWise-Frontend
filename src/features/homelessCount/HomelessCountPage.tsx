import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Popup,
  Source,
  type ErrorEvent as MapLibreErrorEvent,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";

import { LIGHT_BASE_MAP_STYLE } from "../../shared/map/lightBaseMapStyle";
import { AppShell } from "../../shared/ui/AppShell";
import {
  buildHiddenForDistrict,
  COUNCIL_DISTRICTS,
  isHiddenSetForDistrict,
  type CouncilDistrict,
} from "./councilDistricts";
import {
  districtBoundaryLineLayer,
  DISTRICT_BOUNDARY_SOURCE_ID,
  HOMELESS_COUNT_DISTRICT_ID,
  useCouncilDistrictBoundary,
} from "./councilDistrictBoundary";
import { CsaDetailPopup } from "./CsaDetailPopup";
import { CsaDistrictSummary } from "./CsaDistrictSummary";
import { CsaFilterSection } from "./CsaFilterSection";
import { useCsaIndex } from "./csaIndex";
import { DataSourcesSection } from "./DataSourcesSection";
import { MapInfoPanel } from "./MapInfoPanel";
import { readHiddenCsaLabels, writeHiddenCsaLabels } from "./hiddenCsaStorage";
import {
  buildHiddenCsaFilter,
  buildSelectedCsaFilter,
  csaFillLayer,
  csaHighlightLayer,
  csaOutlineLayer,
  csaPropertiesByLabel,
  findCsaFeatureByLabel,
  loadCsaGeojsonOnce,
  useCsaGeojson,
  CSA_ATTRIBUTION,
  CSA_MIN_ZOOM,
  DENSITY_LEGEND_STOPS,
} from "./csaLayers";
import { ShelterDetailPopup } from "./ShelterDetailPopup";
import {
  shelterPointLayer,
  SHELTER_LOW_ZOOM_NOTE,
  SHELTER_SOURCE_LAYER,
  SHELTER_TILES_URL,
  SHELTER_TILE_MAX_ZOOM,
} from "./shelterLayers";

/** The CSA GeoJSON `<Source id>` below; kept as a single source of truth for the onError check. */
const CSA_SOURCE_ID = "csa";

/**
 * The one Scout tile source left on this page. Its `homeless_shelters_and_services` dataset is
 * unaffected by the 2026-09-19 replacement that moved the CSA layer off Scout entirely (see
 * `CSA_GEOJSON_PATH`), so it is deliberately left alone.
 *
 * It was already a separate `<Source>`/id from the CSA layer rather than one request carrying
 * both `?datasets=` values, and that still holds now that there is nothing to combine it with:
 * unmounting it when `showShelters` is off is what actually stops its per-tile requests.
 */
const SHELTER_SOURCE_ID = "shelters";

/**
 * MapLibre merges a `sourceId` onto source-level "error" events at runtime (e.g. a failed tile
 * request), but the public `ErrorEvent` type is shared by every kind of map error and omits it.
 */
type SourceErrorEvent = MapLibreErrorEvent & { sourceId?: string };

/**
 * Cheap bounding-box center of a CSA feature's geometry, as found in the loaded GeoJSON
 * collection — good enough to place a popup near the polygon it describes, not a true centroid,
 * and doesn't need to be (used only when the district readout below opens a card for a row the
 * user didn't actually click on the map).
 *
 * Deliberately untyped (`unknown`) input rather than `GeoJSON.Geometry`: this walks a published
 * extract's geometry at runtime, the same defensively-read spirit as `CsaDetailPopup`'s
 * `readNumber`/`readText` for its attributes, rather than trusting a type for data we didn't
 * produce.
 */
function polygonCenter(geometry: unknown): { longitude: number; latitude: number } | null {
  const coordinates: number[][] = [];
  function collect(value: unknown): void {
    if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
      coordinates.push(value as number[]);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    }
  }
  collect((geometry as { coordinates?: unknown } | null)?.coordinates);

  if (coordinates.length === 0) {
    return null;
  }
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { longitude: (minLng + maxLng) / 2, latitude: (minLat + maxLat) / 2 };
}

/** This demo is scoped to Council District 2, so it's also the default filter and viewport. */
const DEFAULT_DISTRICT = COUNCIL_DISTRICTS.find((district) => district.id === "cd2")!;

const MAP_FIT_BOUNDS_PADDING = 24;

/** Opens fitted to the default district's extent rather than a fixed lng/lat/zoom, so the
 * default viewport and the default filter agree. */
const INITIAL_VIEW_STATE = {
  bounds: DEFAULT_DISTRICT.bounds,
  fitBoundsOptions: { padding: MAP_FIT_BOUNDS_PADDING },
};

interface SelectedCsa {
  properties: Record<string, unknown>;
  longitude: number;
  latitude: number;
}

interface HoveredCsa {
  label: string;
  longitude: number;
  latitude: number;
}

interface SelectedShelter {
  properties: Record<string, unknown>;
  longitude: number;
  latitude: number;
}

export function HomelessCountPage() {
  const { rows, error: indexError, isLoading } = useCsaIndex();
  const mapRef = useRef<MapRef>(null);
  /** Computed once, on mount: `null` means no explicit choice was ever stored, as opposed to a
   * stored empty array ("show everything"), which must NOT be treated the same. */
  const [storedHidden] = useState(() => readHiddenCsaLabels());
  /** Empty set = all 304 neighborhoods shown. Falls back to empty until `rows` load and the
   * default-district effect below can compute the real default (it needs every CSA label). */
  const [hidden, setHidden] = useState<Set<string>>(() => storedHidden ?? new Set());
  const [selected, setSelected] = useState<SelectedCsa | null>(null);
  const [selectedShelter, setSelectedShelter] = useState<SelectedShelter | null>(null);
  /** Desktop-only by nature — `onMouseMove` never fires from touch input, so touch devices just
   * never populate this and fall through to the tap-to-open `selected` card above, unchanged. */
  const [hovered, setHovered] = useState<HoveredCsa | null>(null);
  const [hasTileError, setHasTileError] = useState(false);
  // Both on by default. Unchecking one unmounts its `<Source>` below entirely rather than
  // toggling a layer's `visibility` layout property — a hidden-but-mounted source still issues
  // tile requests, and stopping that network cost (not just the pixels) is the point of the
  // toggle.
  const [showChoropleth, setShowChoropleth] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  /** Third layer, also on by default. Unlike the two Scout sources above, this one is a local
   * GeoJSON file that is already downloaded once the layer has been on — switching it off just
   * unmounts the layer; there are no per-tile requests left for it to stop. */
  const [showDistrictBoundary, setShowDistrictBoundary] = useState(true);
  const districtBoundaryFeature = useCouncilDistrictBoundary(showDistrictBoundary);
  const needsDefaultDistrictRef = useRef(storedHidden === null);
  /** Only set by a real click through `updateHidden`, never by the default-district effect —
   * gates the persistence effect below so applying the *default* is never written back as if it
   * were an explicit choice (that would make "nothing stored" indistinguishable from "user
   * picked CD2" on the next load, freezing today's default into storage forever). */
  const hasUserActionRef = useRef(false);

  const filter = useMemo(() => buildHiddenCsaFilter([...hidden]), [hidden]);

  /** The committed 304-feature collection, loaded once (see `loadCsaGeojsonOnce`) and shared by
   * the map source below and the district readout's live split — neither re-fetches it. */
  const csaCollection = useCsaGeojson();

  /** CSA attributes keyed by label, straight from the loaded collection — no viewport dependency
   * and no "hasn't loaded yet" per-label gap the way a tile query would have: every one of the
   * 304 areas is present as soon as `csaCollection` resolves. Feeds `CsaDistrictSummary`'s
   * unsheltered/sheltered split, which is simply omitted while `csaCollection` is still `null`. */
  const csaAttrsByLabel = useMemo(() => csaPropertiesByLabel(csaCollection), [csaCollection]);

  // Surfaces a failed load of the committed GeoJSON as the same "could not be loaded" message
  // this page has always shown for the CSA layer. `useCsaGeojson` above deliberately swallows the
  // rejection (it only decides what to render), so this listens on the same memoized
  // `loadCsaGeojsonOnce()` promise — no extra network request — purely to raise the flag.
  useEffect(() => {
    let ignore = false;
    loadCsaGeojsonOnce().catch(() => {
      if (!ignore) setHasTileError(true);
    });
    return () => {
      ignore = true;
    };
  }, []);

  /** Falls back to the default district the moment the live filter no longer matches any preset
   * exactly — e.g. the user hand-edited a checkbox after picking District 2. Deliberately no
   * attempt to infer which district was "meant"; see `isHiddenSetForDistrict`. */
  const activeDistrict = useMemo(() => {
    if (!rows) {
      return DEFAULT_DISTRICT;
    }
    return (
      COUNCIL_DISTRICTS.find((district) => isHiddenSetForDistrict(hidden, rows, district)) ??
      DEFAULT_DISTRICT
    );
  }, [rows, hidden]);

  // Applies the default district exactly once, as soon as every CSA label is known — the
  // `useState` initialiser above runs before `rows` has loaded, so it can't compute this.
  useEffect(() => {
    if (!rows || !needsDefaultDistrictRef.current) {
      return;
    }
    needsDefaultDistrictRef.current = false;
    setHidden(buildHiddenForDistrict(rows, DEFAULT_DISTRICT));
  }, [rows]);

  // Persists across reloads and route changes (React Router unmounts this page on navigation).
  useEffect(() => {
    if (!hasUserActionRef.current) {
      return;
    }
    writeHiddenCsaLabels(hidden);
  }, [hidden]);

  // Edge case: a CSA can be selected and then hidden via the neighborhood filter. Left alone,
  // the highlight layer would outline a polygon that is no longer drawn, and the detail card
  // would keep describing an area the map no longer shows — so hiding it also clears the
  // selection.
  //
  // Gated on `hasUserActionRef`, same guard the persistence effect above already uses: this must
  // fire only for an explicit hide (checkbox/dropdown), not for the one-time default-district
  // effect populating `hidden` for the first time. Also keyed off `hidden` alone (via the
  // functional `setSelected` updater), not `[hidden, selected]` — it must fire only when a
  // selection transitions from visible to hidden, not merely whenever something new gets
  // selected.
  useEffect(() => {
    if (!hasUserActionRef.current) {
      return;
    }
    setSelected((current) => {
      const label = typeof current?.properties.CSA_Label === "string" ? current.properties.CSA_Label : null;
      return label && hidden.has(label) ? null : current;
    });
  }, [hidden]);

  function updateHidden(next: Set<string>) {
    hasUserActionRef.current = true;
    setHidden(next);
  }

  function handleSelectDistrict(district: CouncilDistrict) {
    mapRef.current?.fitBounds?.(district.bounds, { padding: MAP_FIT_BOUNDS_PADDING });
  }

  /** The one place a CSA becomes "selected" — opens the detail card and (via `selectedLabel`
   * below) the orange highlight. Both a real polygon click (`handleMapClick`) and a district
   * readout row click (`handleSelectCsaFromList`) funnel through here rather than each setting
   * `selected`/`selectedShelter` themselves. */
  function selectCsa(properties: Record<string, unknown>, longitude: number, latitude: number) {
    setSelected({ properties, longitude, latitude });
    setSelectedShelter(null);
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    // `interactiveLayerIds` already limits hit-testing to the CSA fill and shelter-point layers,
    // so no `queryRenderedFeatures` call is needed — this mirrors CityMap's click handling. Which
    // layer was actually hit is read off `feature.layer.id` so a shelter click opens the shelter
    // popup and a polygon click opens the CSA card, never both at once.
    const feature = event.features?.[0];
    if (!feature) {
      setSelected(null);
      setSelectedShelter(null);
      return;
    }
    if (feature.layer?.id === shelterPointLayer.id) {
      setSelectedShelter({
        properties: feature.properties,
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      });
      setSelected(null);
      return;
    }
    selectCsa(feature.properties, event.lngLat.lng, event.lngLat.lat);
  }

  /** Row click from `CsaDistrictSummary` — selects exactly the way clicking the polygon does
   * (via the shared `selectCsa` above), just without a click event to read a location from. */
  function handleSelectCsaFromList(label: string) {
    const liveFeature = findCsaFeatureByLabel(csaCollection, label);
    if (liveFeature) {
      const center = polygonCenter(liveFeature.geometry);
      if (center) {
        selectCsa(liveFeature.properties, center.longitude, center.latitude);
        return;
      }
    }

    // The collection hasn't loaded yet (or, in principle, this label has no geometry in it).
    // Fall back to the one fact this row is guaranteed to know without fabricating anything —
    // Total_Pop from the static index — placed at the district's own bounds center rather than a
    // real polygon centroid. `CsaDetailPopup`'s existing "—" placeholders already cover every
    // other field being absent.
    const row = rows?.find((candidate) => candidate.CSA_Label === label);
    const [[west, south], [east, north]] = activeDistrict.bounds;
    selectCsa(
      row ? { CSA_Label: label, Total_Pop: row.Total_Pop } : { CSA_Label: label },
      (west + east) / 2,
      (south + north) / 2,
    );
  }

  function handleMapMouseMove(event: MapLayerMouseEvent) {
    // Same reasoning as `handleMapClick`: hit-testing is already scoped to the fill layer via
    // `interactiveLayerIds`, so no `queryRenderedFeatures` call is needed here either.
    const properties = event.features?.[0]?.properties;
    const label = typeof properties?.CSA_Label === "string" ? properties.CSA_Label : null;
    setHovered(label ? { label, longitude: event.lngLat.lng, latitude: event.lngLat.lat } : null);
  }

  function handleMapMouseLeave() {
    setHovered(null);
  }

  function handleMapError(event: SourceErrorEvent) {
    // Only the CSA source's own failures (e.g. a malformed-GeoJSON parse error from MapLibre's
    // worker) should surface as a data error — glyph or basemap-tile errors from the third-party
    // font/raster servers, or the shelters layer's own Scout tiles, are not this. The far more
    // likely failure — the initial `fetch()` of the file itself — is caught separately above.
    if (event.sourceId === CSA_SOURCE_ID) {
      setHasTileError(true);
    }
  }

  // The click card already names this neighborhood, so the hover label is suppressed for it —
  // two stacked popups on one polygon would look broken.
  const selectedLabel =
    typeof selected?.properties.CSA_Label === "string" ? selected.properties.CSA_Label : null;

  // Scoped to whichever layers are actually mounted below — a toggled-off layer's `<Source>` is
  // unmounted entirely, so its id has no business being hit-tested either.
  const interactiveLayerIds = [
    ...(showChoropleth ? [csaFillLayer.id] : []),
    ...(showShelters ? [shelterPointLayer.id] : []),
  ];

  return (
    <AppShell className="homeless-count-shell">
      <main className="homeless-count-page">
        <header className="homeless-count-header">
          <h1 className="homeless-count-title">2020 Greater Los Angeles Homeless Count</h1>
          <p className="homeless-count-subhead">
            Point-in-Time count by Countywide Statistical Area — Los Angeles Homeless Services
            Authority (LAHSA)
          </p>
        </header>

        <div className="homeless-count-body">
          <aside className="homeless-count-panel" aria-label="Map controls">
            <section
              className="homeless-count-layer-section"
              aria-labelledby="homeless-count-layers-heading"
            >
              <h2 id="homeless-count-layers-heading" className="homeless-count-panel-heading">
                Layers
              </h2>
              <label className="homeless-count-layer-toggle">
                <input
                  type="checkbox"
                  checked={showChoropleth}
                  onChange={(event) => setShowChoropleth(event.target.checked)}
                />
                <span
                  className="homeless-count-layer-swatch homeless-count-layer-swatch--choropleth"
                  aria-hidden="true"
                />
                Homeless count density
              </label>
              <label className="homeless-count-layer-toggle">
                <input
                  type="checkbox"
                  checked={showShelters}
                  onChange={(event) => setShowShelters(event.target.checked)}
                />
                <span
                  className="homeless-count-layer-swatch homeless-count-layer-swatch--shelters"
                  aria-hidden="true"
                />
                Shelters &amp; services
              </label>
              {/* Third layer. This section stays the single owner of all three toggles — the
                  "Data sources" section below only reflects this state (see
                  `DataSourcesSection.tsx`), so there is never a second checkbox to disagree
                  with. */}
              <label className="homeless-count-layer-toggle">
                <input
                  type="checkbox"
                  checked={showDistrictBoundary}
                  onChange={(event) => setShowDistrictBoundary(event.target.checked)}
                />
                <span
                  className="homeless-count-layer-swatch homeless-count-layer-swatch--district"
                  aria-hidden="true"
                />
                District {HOMELESS_COUNT_DISTRICT_ID} boundary
              </label>
            </section>

            {rows ? (
              <CsaDistrictSummary
                district={activeDistrict}
                rows={rows}
                liveAttributesByLabel={csaAttrsByLabel}
                onSelectLabel={handleSelectCsaFromList}
              />
            ) : null}

            {rows ? (
              <CsaFilterSection
                rows={rows}
                hiddenLabels={hidden}
                onHiddenChange={updateHidden}
                onSelectDistrict={handleSelectDistrict}
              />
            ) : (
              <p className="homeless-count-controls-status">
                {isLoading ? "Loading neighborhoods…" : indexError}
              </p>
            )}

            <section
              className="homeless-count-legend"
              aria-labelledby="homeless-count-legend-heading"
            >
              <h2 id="homeless-count-legend-heading" className="homeless-count-legend-title">
                Homeless residents per sq. mile (2020)
              </h2>
              <ul className="homeless-count-legend-rows">
                {DENSITY_LEGEND_STOPS.map((stop) => (
                  <li key={stop.label} className="homeless-count-legend-row">
                    <span
                      className="homeless-count-legend-swatch"
                      style={{ backgroundColor: stop.color }}
                      aria-hidden
                    />
                    <span className="homeless-count-legend-label">{stop.label}</span>
                  </li>
                ))}
              </ul>
              <p className="homeless-count-legend-footnote">
                Tract-level estimates aggregated to communities; LAHSA advises against summing them to
                other geographies. Glendale, Pasadena, and Long Beach are reported citywide rather than
                by tract.
              </p>
              {/* Always shown while the layer is on, deliberately with no zoom-threshold logic —
                  the server decimates shelter points heavily at low zoom (see
                  `SHELTER_LOW_ZOOM_FEATURE_COUNTS`), and a simple always-present note is enough to
                  stop a county-scale view from reading as the full list. */}
              {showShelters ? <p className="homeless-count-legend-footnote">{SHELTER_LOW_ZOOM_NOTE}</p> : null}
              {/* A silently blank map is the worst failure mode for a data map, so say so rather
                  than showing a bare basemap if the committed GeoJSON fails to load. */}
              {hasTileError ? (
                <p className="homeless-count-legend-error" role="status">
                  Neighborhood boundaries could not be loaded.
                </p>
              ) : null}
            </section>

            {/* Reference material, so it sits below the legend rather than competing with the
                controls above it. Reflects the layer state; does not own it. */}
            <DataSourcesSection
              layerState={{
                choropleth: showChoropleth,
                shelters: showShelters,
                districtBoundary: showDistrictBoundary,
              }}
            />
          </aside>

          <div className="homeless-count-map-wrap">
          <Map
            ref={mapRef}
            mapStyle={LIGHT_BASE_MAP_STYLE}
            minZoom={CSA_MIN_ZOOM}
            initialViewState={INITIAL_VIEW_STATE}
            interactiveLayerIds={interactiveLayerIds}
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={handleMapMouseLeave}
            cursor={hovered ? "pointer" : undefined}
            onError={handleMapError}
            style={{ width: "100%", height: "100%" }}
            // `attributionControl` is deliberately left at its default (on): ODbL requires
            // visible attribution, and the other map surfaces in this repo suppress it.
          >
            {/* A geojson source, not a tile source — see `CSA_GEOJSON_PATH` in `csaLayers.ts`.
                `data` is the already-parsed collection (`csaCollection`), not the URL, which is
                what keeps this to a single fetch of the 1.1 MB file; rendered only once that
                fetch has resolved, so a slow or failed load leaves the rest of the map (and the
                `hasTileError` message above) to do the talking instead of an empty source. */}
            {showChoropleth && csaCollection ? (
              <Source
                id={CSA_SOURCE_ID}
                type="geojson"
                data={csaCollection}
                attribution={CSA_ATTRIBUTION}
              >
                <Layer {...csaFillLayer} filter={filter} />
                <Layer {...csaOutlineLayer} filter={filter} />
                {selectedLabel ? (
                  <Layer {...csaHighlightLayer} filter={buildSelectedCsaFilter(selectedLabel)} />
                ) : null}
              </Source>
            ) : null}

            {/* A separate `<Source>` from the CSA one above, not a combined `?datasets=` request
                — see `SHELTER_SOURCE_ID`'s comment for the measured byte counts behind that call.
                Unmounted entirely (not just visually hidden) when `showShelters` is off, which is
                what actually stops its tile requests. */}
            {showShelters ? (
              <Source
                id={SHELTER_SOURCE_ID}
                type="vector"
                tiles={[SHELTER_TILES_URL]}
                minzoom={0}
                maxzoom={SHELTER_TILE_MAX_ZOOM}
              >
                <Layer {...shelterPointLayer} source-layer={SHELTER_SOURCE_LAYER} />
              </Source>
            ) : null}

            {/* The real Council District 2 outline, as a line layer only — it sits on top of the
                choropleth and must not tint it. A local GeoJSON `<Source>`, not a tile source:
                unmounting it stops nothing being fetched (the file is already on the client by
                then), it just stops drawing. Rendered only once the feature has resolved, so a
                slow or failed load leaves the rest of the map untouched. */}
            {showDistrictBoundary && districtBoundaryFeature ? (
              <Source id={DISTRICT_BOUNDARY_SOURCE_ID} type="geojson" data={districtBoundaryFeature}>
                <Layer {...districtBoundaryLineLayer} />
              </Source>
            ) : null}

            {selected ? (
              // maxWidth is the popup container's cap; it must be >= the card's border-box width
              // (.homeless-count-popup: 16rem, app.css) plus the 2px border MapLibre puts on
              // .maplibregl-popup-content (1px each side). Expressed as a calc() in the card's own
              // unit (rem) rather than a hardcoded px figure, so it can't fall out of sync with a
              // user's root font size — MapLibre assigns this straight to a CSS maxWidth, so a
              // calc() string is valid here. Keep these two numbers in sync.
              <Popup
                longitude={selected.longitude}
                latitude={selected.latitude}
                closeOnClick={false}
                onClose={() => setSelected(null)}
                maxWidth="calc(16rem + 2px)"
              >
                <CsaDetailPopup properties={selected.properties} />
              </Popup>
            ) : null}

            {selectedShelter ? (
              <Popup
                longitude={selectedShelter.longitude}
                latitude={selectedShelter.latitude}
                closeOnClick={false}
                onClose={() => setSelectedShelter(null)}
                maxWidth="calc(16rem + 2px)"
              >
                <ShelterDetailPopup properties={selectedShelter.properties} />
              </Popup>
            ) : null}

            {hovered && hovered.label !== selectedLabel ? (
              <Popup
                longitude={hovered.longitude}
                latitude={hovered.latitude}
                closeButton={false}
                closeOnClick={false}
                offset={14}
                // Adds this class to the popup's own container (not just its content), which is
                // what `.homeless-count-hover-popup` in app.css targets to stop this label from
                // intercepting the hover/click events on the polygon underneath it.
                className="homeless-count-hover-popup"
              >
                <div className="homeless-count-hover-label">{hovered.label}</div>
              </Popup>
            ) : null}
          </Map>
          {/* Sibling of <Map>, not a child: it is page chrome over the map surface, and MapLibre
              owns its own control corners. Top-right is unoccupied here — see MapInfoPanel. */}
          <MapInfoPanel />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
