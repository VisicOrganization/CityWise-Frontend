import type { GeoJSONSource } from "maplibre-gl";
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
import { COUNCIL_DISTRICTS } from "./councilDistricts";
import {
  districtBoundaryLineLayer,
  DISTRICT_BOUNDARY_SOURCE_ID,
  HOMELESS_COUNT_DISTRICT_ID,
  useCouncilDistrictBoundary,
} from "./councilDistrictBoundary";
import { CsaDetailPopup } from "./CsaDetailPopup";
import { CsaDistrictSummary } from "./CsaDistrictSummary";
import { useCsaIndex } from "./csaIndex";
import { DataSourcesSection } from "./DataSourcesSection";
import { EncampmentMonthFilter } from "./EncampmentMonthFilter";
import { EncampmentReportPopup } from "./EncampmentReportPopup";
import {
  buildMonthOptions,
  encampmentClusterCountLayer,
  encampmentClusterLayer,
  encampmentPointLayer,
  filterReportsByMonth,
  reportsAtClickedPoint,
  useEncampmentReports,
  ENCAMPMENT_CLUSTER_MAX_ZOOM,
  ENCAMPMENT_CLUSTER_RADIUS,
  ENCAMPMENT_NOTE,
} from "./encampmentLayers";
import { HomelessCountLegend } from "./HomelessCountLegend";
import { MapInfoPanel } from "./MapInfoPanel";
import {
  buildVisibleCsaFilter,
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

/** Empty, always-mounted layer that every non-encampment layer is inserted under; see the JSX. */
const OVERLAY_ANCHOR_LAYER_ID = "overlay-anchor";
const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** The 311 encampment-report GeoJSON `<Source>`; read back for cluster expansion. */
const ENCAMPMENT_SOURCE_ID = "encampments";

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

/** This demo is scoped to Council District 2 — the only district, the only viewport, and the only
 * set of CSAs the map ever draws. There is no picker: see `CSA_FILTER`. */
const DISTRICT = COUNCIL_DISTRICTS.find((district) => district.id === "cd2")!;

/** Fixed for the life of the page, so it is built once at module scope rather than memoized off
 * state that can no longer change. The 7 labels are named positively (`buildVisibleCsaFilter`),
 * not as the complement of the other 297: the district is the thing this page is about, and the
 * filter should say so. */
const CSA_FILTER = buildVisibleCsaFilter(DISTRICT.csaLabels);

/** Opens fitted to the district's extent rather than a fixed lng/lat/zoom, so the viewport and
 * the filter agree. */
const INITIAL_VIEW_STATE = {
  bounds: DISTRICT.bounds,
  fitBoundsOptions: { padding: 24 },
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

interface SelectedEncampment {
  /** Every report stacked at the clicked point, newest first (`reportsAtClickedPoint`). */
  reports: Record<string, unknown>[];
  longitude: number;
  latitude: number;
}

export function HomelessCountPage() {
  const { rows, error: indexError, isLoading } = useCsaIndex();
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<SelectedCsa | null>(null);
  const [selectedShelter, setSelectedShelter] = useState<SelectedShelter | null>(null);
  const [selectedEncampment, setSelectedEncampment] = useState<SelectedEncampment | null>(null);
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
  /** Off by default, unlike the three layers above: 2026 311 reports are a different kind of data
   * from the 2020 count this page opens on, and leaving it off means the ~140 KB (gzipped) file is
   * only fetched by someone who asks for it (`useEncampmentReports` is gated on it). */
  const [showEncampments, setShowEncampments] = useState(false);
  const { collection: encampmentCollection, hasError: hasEncampmentError } =
    useEncampmentReports(showEncampments);
  /** Months switched off in the "Month filed" filter. Empty = every month shown. */
  const [hiddenEncampmentMonths, setHiddenEncampmentMonths] = useState<Set<string>>(() => new Set());
  const encampmentMonthOptions = useMemo(
    () => buildMonthOptions(encampmentCollection),
    [encampmentCollection],
  );
  const visibleEncampments = useMemo(
    () => encampmentCollection && filterReportsByMonth(encampmentCollection, hiddenEncampmentMonths),
    [encampmentCollection, hiddenEncampmentMonths],
  );
  const districtBoundaryFeature = useCouncilDistrictBoundary(showDistrictBoundary);

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

  /** The one place a CSA becomes "selected" — opens the detail card and (via `selectedLabel`
   * below) the orange highlight. Both a real polygon click (`handleMapClick`) and a district
   * readout row click (`handleSelectCsaFromList`) funnel through here rather than each setting
   * `selected`/`selectedShelter` themselves. */
  function selectCsa(properties: Record<string, unknown>, longitude: number, latitude: number) {
    setSelected({ properties, longitude, latitude });
    setSelectedShelter(null);
    setSelectedEncampment(null);
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
      setSelectedEncampment(null);
      return;
    }
    if (feature.layer?.id === encampmentClusterLayer.id) {
      // A cluster is a count, not a report — zoom to where it splits apart instead of opening a
      // card. Stacks at one identical coordinate never split; past `ENCAMPMENT_CLUSTER_MAX_ZOOM`
      // they render as points, which the branch below lists together.
      const source = mapRef.current?.getSource?.(ENCAMPMENT_SOURCE_ID) as GeoJSONSource | undefined;
      const clusterId = feature.properties.cluster_id;
      const center = (feature.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
      if (source && typeof clusterId === "number" && center) {
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => mapRef.current?.easeTo({ center, zoom }))
          // Rejects if the source is removed mid-request (layer toggled off); nothing to do then.
          .catch(() => {});
      }
      return;
    }
    if (feature.layer?.id === encampmentPointLayer.id) {
      setSelectedEncampment({
        reports: reportsAtClickedPoint(event.features ?? []),
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      });
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
      setSelectedEncampment(null);
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
    const [[west, south], [east, north]] = DISTRICT.bounds;
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
    ...(showEncampments ? [encampmentClusterLayer.id, encampmentPointLayer.id] : []),
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
              {/* Third layer. This section stays the single owner of all four toggles — the
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
              <label className="homeless-count-layer-toggle">
                <input
                  type="checkbox"
                  checked={showEncampments}
                  onChange={(event) => {
                    setShowEncampments(event.target.checked);
                    // Same reasoning as hiding a selected CSA: no card for points no longer drawn.
                    if (!event.target.checked) setSelectedEncampment(null);
                  }}
                />
                <span
                  className="homeless-count-layer-swatch homeless-count-layer-swatch--encampments"
                  aria-hidden="true"
                />
                311 encampment reports (CD2, 2026)
              </label>
            </section>

            {rows ? (
              <CsaDistrictSummary
                district={DISTRICT}
                rows={rows}
                liveAttributesByLabel={csaAttrsByLabel}
                onSelectLabel={handleSelectCsaFromList}
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
              {/* The density key itself moved onto the map (`HomelessCountLegend`); what is left
                  here is the reading the map cannot carry — caveats and failure messages. */}
              <h2 id="homeless-count-legend-heading" className="homeless-count-legend-title">
                Notes &amp; caveats
              </h2>
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
              {showEncampments ? <p className="homeless-count-legend-footnote">{ENCAMPMENT_NOTE}</p> : null}
              {showEncampments && hasEncampmentError ? (
                <p className="homeless-count-legend-error" role="status">
                  Encampment reports could not be loaded.
                </p>
              ) : null}
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
                encampments: showEncampments,
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
            {/* Always mounted, first, and draws nothing. Every non-encampment layer below mounts
                with `beforeId={OVERLAY_ANCHOR_LAYER_ID}`, so however late it (re)mounts on a
                toggle or selection, it lands under this anchor -- and so under the encampment
                layers, which have no `beforeId` and append above it. Without it, a remounted
                layer lands on TOP of the style (see `NeighborhoodOverlay.tsx`), covering the dots
                and stealing `features[0]` in `handleMapClick`. */}
            <Source id="overlay-anchor" type="geojson" data={EMPTY_FEATURE_COLLECTION}>
              <Layer id={OVERLAY_ANCHOR_LAYER_ID} type="circle" paint={{ "circle-radius": 0 }} />
            </Source>

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
                <Layer {...csaFillLayer} filter={CSA_FILTER} beforeId={OVERLAY_ANCHOR_LAYER_ID} />
                <Layer {...csaOutlineLayer} filter={CSA_FILTER} beforeId={OVERLAY_ANCHOR_LAYER_ID} />
                {selectedLabel ? (
                  <Layer
                    {...csaHighlightLayer}
                    filter={buildSelectedCsaFilter(selectedLabel)}
                    beforeId={OVERLAY_ANCHOR_LAYER_ID}
                  />
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
                <Layer
                  {...shelterPointLayer}
                  source-layer={SHELTER_SOURCE_LAYER}
                  beforeId={OVERLAY_ANCHOR_LAYER_ID}
                />
              </Source>
            ) : null}

            {/* The real Council District 2 outline, as a line layer only — it sits on top of the
                choropleth and must not tint it. A local GeoJSON `<Source>`, not a tile source:
                unmounting it stops nothing being fetched (the file is already on the client by
                then), it just stops drawing. Rendered only once the feature has resolved, so a
                slow or failed load leaves the rest of the map untouched. */}
            {showDistrictBoundary && districtBoundaryFeature ? (
              <Source id={DISTRICT_BOUNDARY_SOURCE_ID} type="geojson" data={districtBoundaryFeature}>
                <Layer {...districtBoundaryLineLayer} beforeId={OVERLAY_ANCHOR_LAYER_ID} />
              </Source>
            ) : null}

            {/* No `beforeId`, so these layers append above the overlay anchor and every layer
                placed under it, and win the hit-test that `handleMapClick` reads off
                `features[0]`. Fed the month-filtered collection, so
                cluster counts only ever count reports in the selected months. */}
            {showEncampments && visibleEncampments ? (
              <Source
                id={ENCAMPMENT_SOURCE_ID}
                type="geojson"
                data={visibleEncampments}
                cluster
                clusterMaxZoom={ENCAMPMENT_CLUSTER_MAX_ZOOM}
                clusterRadius={ENCAMPMENT_CLUSTER_RADIUS}
              >
                <Layer {...encampmentClusterLayer} />
                <Layer {...encampmentClusterCountLayer} />
                <Layer {...encampmentPointLayer} />
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

            {selectedEncampment ? (
              <Popup
                longitude={selectedEncampment.longitude}
                latitude={selectedEncampment.latitude}
                closeOnClick={false}
                onClose={() => setSelectedEncampment(null)}
                maxWidth="calc(16rem + 2px)"
              >
                {/* Keyed on the clicked point so "Show all" doesn't carry over to the next stack. */}
                <EncampmentReportPopup
                  key={`${selectedEncampment.longitude},${selectedEncampment.latitude}`}
                  reports={selectedEncampment.reports}
                />
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
              owns its own control corners. Top-right holds this, then the month filter, then the
              density key — all three stacked downward from it. See MapInfoPanel. */}
          <MapInfoPanel />
          {/* The two cards that sit under the Info button, in one flow column rather than each
              pinned at its own `top`: either can be absent, and a column closes the gap the
              missing one leaves instead of stranding the survivor halfway down the map. */}
          <div className="homeless-count-map-chrome">
            {/* Only while the layer it filters is on — a filter for dots that aren't drawn would
                read as broken. */}
            {showEncampments && encampmentMonthOptions.length > 0 ? (
              <EncampmentMonthFilter
                options={encampmentMonthOptions}
                hiddenMonths={hiddenEncampmentMonths}
                onHiddenMonthsChange={(next) => {
                  setHiddenEncampmentMonths(next);
                  // The open card may list reports from a month that was just hidden.
                  setSelectedEncampment(null);
                }}
              />
            ) : null}
            {/* Same rule, same condition as the choropleth it decodes below: a six-step key for
                polygons that aren't drawn describes nothing. */}
            {showChoropleth && csaCollection ? <HomelessCountLegend /> : null}
          </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
