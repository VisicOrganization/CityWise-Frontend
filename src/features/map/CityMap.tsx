import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type ViewState,
} from "react-map-gl/maplibre";
import type { FilterSpecification, StyleSpecification } from "maplibre-gl";

import { MapAddressSearch } from "./MapAddressSearch";
import { useCouncilMemberBios } from "../districts/useCouncilMemberBios";
import { useDistrictProfile } from "../districts/useDistrictProfile";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { formatProjectTitleForDisplay } from "../../shared/formatProjectTitleForDisplay";
import { findDistrictFeature, getFeatureBounds, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import { districtFillLayer, districtFillOpacityExpression, districtHighlightLayer, districtOutlineLayer } from "../../shared/map/districtLayers";
import type { MapMarker, MarkerCategory } from "../../shared/map/mapTypes";
import { InfoIcon } from "../../shared/ui/visicIcons";

const LIGHT_BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    raster: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#eef2f5",
      },
    },
    {
      id: "raster-base",
      type: "raster",
      source: "raster",
      paint: {
        "raster-opacity": 0.97,
        "raster-saturation": -0.18,
      },
    },
  ],
};

const PIN_SRC: Record<MarkerCategory, string> = {
  housing: "/images/pins/brown-pin.svg",
  transit: "/images/pins/brown-pin.svg",
  parks: "/images/pins/brown-pin.svg",
};

const PIN_TITLE_COLOR: Record<MarkerCategory, string> = {
  housing: "#8d6e63",
  transit: "#3779f4",
  parks: "#00ae6d",
};

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.4118,
  latitude: 34.021,
  zoom: 8.8,
  bearing: 0,
  pitch: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

const DEFAULT_DISTRICT_IDS = Array.from({ length: 15 }, (_, index) => index + 1);

function buildHighlightLayer(activeDistrictId: number) {
  return {
    ...districtHighlightLayer,
    filter: ["==", ["get", "District"], activeDistrictId] as ["==", ["get", string], number],
  } satisfies typeof districtHighlightLayer;
}

function buildDistrictFillLayer(selectedDistrictIds: number[]) {
  const selectedDistrictFilter: FilterSpecification =
    selectedDistrictIds.length > 0
      ? (["match", ["get", "District"], selectedDistrictIds, true, false] as FilterSpecification)
      : false;

  return {
    ...districtFillLayer,
    id: "district-fill-selected",
    filter: selectedDistrictFilter,
  } satisfies typeof districtFillLayer;
}

function buildDistrictFillDimLayer() {
  return {
    ...districtFillLayer,
    id: "district-fill-dim",
    paint: {
      ...districtFillLayer.paint,
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        0.42 * 0.35,
        9.5,
        0.28 * 0.35,
        12,
        0.16 * 0.35,
        14.5,
        0.08 * 0.35,
      ],
    },
  } satisfies typeof districtFillLayer;
}

interface CityMapProps {
  boundaries: DistrictBoundaryCollection | null;
  markers: MapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number | null;
  /** Geocoded address from landing; used to zoom before district GeoJSON is ready, and as fallback. */
  addressFocusPoint?: { latitude: number; longitude: number } | null;
  /** Increments when map should re-center on current district. */
  districtRefocusSignal?: number;
  /** Hide map chrome (search + control stack + feedback) while another sheet is open. */
  hideMapChrome?: boolean;
  /** Hides the floating district pill (e.g. while the district overview sheet is open — avoids a second “divot”). */
  districtOverviewOpen?: boolean;
  onMarkerSelect: (marker: MapMarker) => void;
  onMapBackgroundClick: () => void;
  onOpenDistrictOverview: (districtId: number) => void;
  onDistrictSelect: (districtId: number | null) => void;
}

export function CityMap({
  boundaries,
  markers,
  activeMarkerId,
  activeDistrictId,
  addressFocusPoint = null,
  districtRefocusSignal = 0,
  hideMapChrome = false,
  districtOverviewOpen = false,
  onMarkerSelect,
  onMapBackgroundClick,
  onOpenDistrictOverview,
  onDistrictSelect,
}: CityMapProps) {
  const posthog = usePostHog();
  const DISTRICT_PILL_SWAP_MS = 140;
  const mapRef = useRef<MapRef>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const lastDistrictFocusRef = useRef<number | null>(null);
  const lastHandledRefocusSignalRef = useRef(0);
  const lastPillDistrictIdRef = useRef<number | null>(null);
  const pillSwapTimeoutRef = useRef<number | null>(null);
  const [lastVisibleDistrictId, setLastVisibleDistrictId] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [searchDismissSignal, setSearchDismissSignal] = useState(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDistrictFilterOpen, setIsDistrictFilterOpen] = useState(false);
  const [pillPortraitFailed, setPillPortraitFailed] = useState(false);
  const [isDistrictPillVisible, setIsDistrictPillVisible] = useState(true);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<Set<number>>(
    () => new Set(DEFAULT_DISTRICT_IDS),
  );
  const hasInitializedDistrictFilterRef = useRef(false);

  const { profile: districtProfile } = useDistrictProfile(activeDistrictId);
  const { biosByDistrict } = useCouncilMemberBios();
  const activeDistrict = activeDistrictId != null;
  const displayedDistrictId = activeDistrictId ?? lastVisibleDistrictId;
  const bio = activeDistrictId != null ? biosByDistrict?.get(activeDistrictId) : undefined;
  const councilNameRaw = (bio?.name?.trim() || districtProfile?.name?.trim() || "") || "";
  const displayedName = councilNameRaw
    ? formatPersonNameForDisplay(councilNameRaw)
    : displayedDistrictId != null
      ? `District ${displayedDistrictId}`
      : "District";
  const displayedLabel =
    displayedDistrictId != null ? `District ${displayedDistrictId}` : "";
  const portraitSrc = (bio?.profilePic?.trim() || districtProfile?.profile_pic?.trim() || "").trim() || null;
  const initials = displayedName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("");
  const availableDistrictIds = useMemo(() => {
    const ids = new Set<number>();
    markers.forEach((marker) => {
      if (marker.districtId != null) {
        ids.add(marker.districtId);
      }
    });
    return (ids.size > 0 ? [...ids] : DEFAULT_DISTRICT_IDS).sort((a, b) => a - b);
  }, [markers]);
  const visibleMarkers = useMemo(
    () => markers.filter((marker) => marker.districtId != null && selectedDistrictIds.has(marker.districtId)),
    [markers, selectedDistrictIds],
  );
  const selectedDistrictIdList = useMemo(() => [...selectedDistrictIds], [selectedDistrictIds]);

  const setMapInstance = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    setIsMapReady(Boolean(instance));
  }, []);

  useEffect(() => {
    if (activeDistrictId) {
      setLastVisibleDistrictId(activeDistrictId);
    }
  }, [activeDistrictId]);

  useEffect(() => {
    if (districtOverviewOpen) {
      setIsInfoOpen(false);
      setIsMenuOpen(false);
      setIsDistrictFilterOpen(false);
    }
  }, [districtOverviewOpen]);

  useEffect(() => {
    if (!hasInitializedDistrictFilterRef.current && availableDistrictIds.length > 0) {
      setSelectedDistrictIds(new Set(availableDistrictIds));
      hasInitializedDistrictFilterRef.current = true;
    }
  }, [availableDistrictIds]);

  useEffect(() => {
    if (!activeMarkerId) {
      return;
    }

    const markerIsVisible = visibleMarkers.some((marker) => marker.id === activeMarkerId);
    if (!markerIsVisible) {
      onMapBackgroundClick();
    }
  }, [activeMarkerId, onMapBackgroundClick, visibleMarkers]);

  useEffect(() => {
    setPillPortraitFailed(false);
  }, [portraitSrc, activeDistrictId]);

  useEffect(() => {
    return () => {
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeDistrictId == null) {
      lastPillDistrictIdRef.current = null;
      setIsDistrictPillVisible(false);
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
        pillSwapTimeoutRef.current = null;
      }
      return;
    }

    const previousDistrictId = lastPillDistrictIdRef.current;
    lastPillDistrictIdRef.current = activeDistrictId;

    if (previousDistrictId == null || previousDistrictId === activeDistrictId) {
      setIsDistrictPillVisible(true);
      return;
    }

    setIsDistrictPillVisible(false);
    if (pillSwapTimeoutRef.current != null) {
      window.clearTimeout(pillSwapTimeoutRef.current);
    }
    pillSwapTimeoutRef.current = window.setTimeout(() => {
      setIsDistrictPillVisible(true);
      pillSwapTimeoutRef.current = null;
    }, DISTRICT_PILL_SWAP_MS);
  }, [activeDistrictId]);

  useLayoutEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !isMapReady) {
      return;
    }

    const shouldForceRefocus = districtRefocusSignal !== lastHandledRefocusSignalRef.current;
    if (shouldForceRefocus) {
      lastHandledRefocusSignalRef.current = districtRefocusSignal;
      lastDistrictFocusRef.current = null;
    }

    if (activeDistrictId == null) {
      lastDistrictFocusRef.current = null;
      if (addressFocusPoint) {
        map.jumpTo({
          center: [addressFocusPoint.longitude, addressFocusPoint.latitude],
          zoom: Math.max(map.getZoom(), 12.8),
        });
      }
      return;
    }

    if (boundaries) {
      const districtFeature = findDistrictFeature(boundaries, activeDistrictId);
      if (districtFeature) {
        const [[minLng, minLat], [maxLng, maxLat]] = getFeatureBounds(districtFeature);
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        const previousFocusedId = lastDistrictFocusRef.current;
        const isSwitchingDistrict =
          previousFocusedId != null && previousFocusedId !== activeDistrictId;

        if (isSwitchingDistrict) {
          lastDistrictFocusRef.current = activeDistrictId;
          map.jumpTo({
            center: [centerLng, centerLat],
          });
          return;
        }

        if (previousFocusedId === activeDistrictId) {
          return;
        }

        const lngSpan = Math.max(maxLng - minLng, 0.0025);
        const latSpan = Math.max(maxLat - minLat, 0.0025);
        const horizontalZoom = Math.log2(360 / lngSpan) - 1.4;
        const verticalZoom = Math.log2(180 / latSpan) - 0.8;
        const focusZoom = Math.max(9.8, Math.min(13.6, Math.min(horizontalZoom, verticalZoom)));

        lastDistrictFocusRef.current = activeDistrictId;
        map.jumpTo({
          center: [centerLng, centerLat],
          zoom: focusZoom,
        });
        return;
      }
    }

    if (addressFocusPoint) {
      map.jumpTo({
        center: [addressFocusPoint.longitude, addressFocusPoint.latitude],
        zoom: Math.max(map.getZoom(), 12.8),
      });
    }
  }, [activeDistrictId, boundaries, addressFocusPoint, districtRefocusSignal, isMapReady]);

  function handleZoom(delta: number) {
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    setSearchDismissSignal((n) => n + 1);
    onMapBackgroundClick();

    const clickedFeature = event.features?.find((feature) => {
      const districtValue = feature.properties?.District;
      return typeof districtValue === "number" || typeof districtValue === "string";
    });

    if (!clickedFeature) {
      onDistrictSelect(null);
      return;
    }

    const districtValue = clickedFeature.properties?.District;
    const parsedDistrictId = Number(districtValue);
    if (Number.isNaN(parsedDistrictId)) {
      onDistrictSelect(null);
      return;
    }

    onDistrictSelect(parsedDistrictId);
  }

  return (
    <div className="city-demo-map">
      <Map
        ref={setMapInstance}
        initialViewState={DEFAULT_VIEW_STATE}
        onClick={handleMapClick}
        interactiveLayerIds={["district-fill"]}
        mapStyle={LIGHT_BASE_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {boundaries ? (
          <Source id="district-boundaries" type="geojson" data={boundaries}>
            <Layer {...buildDistrictFillDimLayer()} />
            <Layer {...buildDistrictFillLayer(selectedDistrictIdList)} />
            <Layer {...districtOutlineLayer} />
            {activeDistrictId != null ? <Layer {...buildHighlightLayer(activeDistrictId)} /> : null}
          </Source>
        ) : null}

        {visibleMarkers.map((marker) => {
          const showHoverCard = hoveredMarkerId === marker.id;
          const markerZIndex = activeMarkerId === marker.id ? 4 : showHoverCard ? 6 : 1;
          const titleColor = PIN_TITLE_COLOR[marker.category];
          const pinSrc = PIN_SRC[marker.category];

          return (
            <Marker
              key={marker.id}
              longitude={marker.longitude}
              latitude={marker.latitude}
              anchor="bottom"
              subpixelPositioning
              style={{ zIndex: markerZIndex }}
            >
              <button
                type="button"
                className={`map-project-marker ${activeMarkerId === marker.id ? "marker-active" : ""}`}
                aria-label={marker.label}
                onMouseEnter={() => setHoveredMarkerId(marker.id)}
                onMouseLeave={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                onFocus={() => setHoveredMarkerId(marker.id)}
                onBlur={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onMarkerSelect(marker);
                }}
              >
                <span className="map-marker-pin-anchor">
                  {showHoverCard ? (
                    <span className="map-marker-hover-card" role="tooltip">
                      <span className="map-marker-hover-title">{formatProjectTitleForDisplay(marker.label)}</span>
                      {marker.summary.trim() ? (
                        <p className="map-marker-hover-summary">{marker.summary}</p>
                      ) : null}
                      <span className="map-marker-hover-cta">Click to learn more.</span>
                    </span>
                  ) : null}
                  <span
                    className={`map-marker-district-badge ${activeMarkerId === marker.id ? "is-active" : ""}`.trim()}
                    aria-hidden
                  >
                    {marker.districtId ?? ""}
                  </span>
                  <img
                    className="map-marker-pin-img"
                    src={pinSrc}
                    alt=""
                    width={39}
                    height={48}
                    draggable={false}
                  />
                  {/* <span className="map-marker-side-title" style={{ color: titleColor }}>
                    {marker.label}
                  </span> */}
                </span>
              </button>
            </Marker>
          );
        })}
      </Map>

      <div
        className={`map-district-pill-shell ${
          activeDistrict && !districtOverviewOpen && isDistrictPillVisible && !isSearchExpanded
            ? "is-visible"
            : "is-hidden"
        }`}
      >
        <button
          type="button"
          className="map-district-pill"
          onClick={() => {
            if (activeDistrictId != null) {
              onOpenDistrictOverview(activeDistrictId);
            }
          }}
          aria-label={activeDistrictId != null ? `Open District ${activeDistrictId} overview` : "District overview hidden"}
          aria-hidden={activeDistrict && !districtOverviewOpen ? undefined : true}
          tabIndex={activeDistrict && !districtOverviewOpen ? 0 : -1}
        >
          <span className="map-district-avatar" aria-hidden="true">
            {portraitSrc && !pillPortraitFailed ? (
              <img
                src={portraitSrc}
                alt=""
                className="map-district-avatar-img"
                onError={() => setPillPortraitFailed(true)}
              />
            ) : (
              <span className="map-district-avatar-initials">{initials}</span>
            )}
          </span>
          <span className="map-district-pill-copy">
            <span className="map-district-pill-name">{displayedName}</span>
            <span className="map-district-pill-sep" aria-hidden="true">
              {" "}
              •{" "}
            </span>
            <span className="map-district-pill-district">{displayedLabel}</span>
          </span>
        </button>
      </div>

      {districtOverviewOpen || hideMapChrome ? null : (
        <>
          <div className="map-search-dock">
            <MapAddressSearch dismissSignal={searchDismissSignal} onExpandedChange={setIsSearchExpanded} />
          </div>

          <div className="map-control-stack map-control-stack--figma" aria-label="Map controls">
            <div className="map-figma-controls-wrap">
              <div className="map-control-pill map-control-pill--stacked">
                <button
                  type="button"
                  className={`map-figma-ctrl-btn ${isMenuOpen ? "is-active" : ""}`}
                  aria-label="Map menu"
                  aria-expanded={isMenuOpen}
                  onClick={() => {
                    setIsMenuOpen((current) => !current);
                    setIsInfoOpen(false);
                    setIsDistrictFilterOpen(false);
                  }}
                >
                  <img src="/menu-icon.svg" alt="" width={18} height={12} />
                </button>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <button
                  type="button"
                  className={`map-figma-ctrl-btn ${isInfoOpen ? "is-active" : ""}`}
                  aria-label="Toggle accessibility information"
                  aria-expanded={isInfoOpen}
                  onClick={() => {
                    setIsInfoOpen((current) => !current);
                    setIsMenuOpen(false);
                    setIsDistrictFilterOpen(false);
                  }}
                >
                  <InfoIcon className="map-figma-info-icon" width={18} height={18} aria-hidden />
                </button>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <button
                  type="button"
                  className={`map-figma-ctrl-btn ${isDistrictFilterOpen ? "is-active" : ""}`}
                  aria-label="Filter projects by district"
                  aria-expanded={isDistrictFilterOpen}
                  onClick={() => {
                    setIsDistrictFilterOpen((current) => !current);
                    setIsMenuOpen(false);
                    setIsInfoOpen(false);
                  }}
                >
                  <span className="map-figma-filter-label" aria-hidden>
                    CD
                  </span>
                </button>
              </div>

              <div className="map-control-pill map-control-pill--stacked">
                <button type="button" className="map-figma-ctrl-btn" aria-label="Zoom in" onClick={() => handleZoom(0.65)}>
                  <img src="/zoom-in-icon.svg" alt="" width={18} height={18} />
                </button>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <button type="button" className="map-figma-ctrl-btn" aria-label="Zoom out" onClick={() => handleZoom(-0.65)}>
                  <img src="/zoom-out-icon.svg" alt="" width={18} height={18} />
                </button>
              </div>

              {isMenuOpen ? (
                <div className="map-figma-flyout map-figma-flyout--menu" aria-label="Map menu">
                  <div className="map-utility-header">
                    <strong>Map menu</strong>
                    <span>Quick tips</span>
                  </div>
                  <p>Use district shading for context and pins for council projects.</p>
                  <ul className="map-utility-list">
                    <li>Search for an address in the top-left control.</li>
                    <li>Open the info button for map guidance.</li>
                  </ul>
                </div>
              ) : null}

              {isInfoOpen ? (
                <div className="map-figma-flyout map-figma-flyout--info" aria-label="Accessibility information">
                  <div className="map-utility-header">
                    <strong>Map guidance</strong>
                    <span>Informational</span>
                  </div>
                  <p>Use the district overlays for geographic context and the project markers for quick detail checks.</p>
                  <ul className="map-utility-list">
                    <li>Hover markers to preview project names.</li>
                    <li>Click markers to open project details.</li>
                    <li>Click a district boundary to update the district overview pill.</li>
                  </ul>
                </div>
              ) : null}

              {isDistrictFilterOpen ? (
                <div className="map-figma-flyout map-figma-flyout--district-filter" aria-label="District project filters">
                  <div className="map-utility-header">
                    <strong>District filters</strong>
                    <span>Pins</span>
                  </div>
                  <p>Select council districts to show project pins on the map.</p>
                  <div className="map-district-filter-actions" role="group" aria-label="District filter quick actions">
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => setSelectedDistrictIds(new Set(availableDistrictIds))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="map-district-filter-action-btn"
                      onClick={() => setSelectedDistrictIds(new Set<number>())}
                    >
                      Deselect all
                    </button>
                  </div>
                  <div className="map-district-filter-grid">
                    {availableDistrictIds.map((districtId) => (
                      <label key={districtId} className="map-district-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedDistrictIds.has(districtId)}
                          onChange={() => {
                            setSelectedDistrictIds((current) => {
                              const next = new Set(current);
                              if (next.has(districtId)) {
                                next.delete(districtId);
                              } else {
                                next.add(districtId);
                              }
                              return next;
                            });
                          }}
                        />
                        <span>{`District ${districtId}`}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {hideMapChrome ? null : (
        <a
          className="map-feedback-button"
          href="https://forms.gle/kqi9Ex3VA47HhoC28"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open CityWise feedback form in a new tab"
          onClick={() => posthog?.capture("feedback_button_clicked")}
        >
          Give us your feedback!
        </a>
      )}
    </div>
  );
}
