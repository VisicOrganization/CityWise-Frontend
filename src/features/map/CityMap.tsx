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
import {
  districtFillLayer,
  districtFillOpacityExpression,
  districtHighlightLayer,
  districtLabelsLayer,
  districtOutlineLayer,
} from "../../shared/map/districtLayers";
import { categoryDescription } from "../../shared/data/categoryDescriptions";
import { CATEGORY_COLOR, MARKER_CATEGORIES, type MapMarker, type MarkerCategory } from "../../shared/map/mapTypes";
import { ProjectAffiliationChips, AFFILIATION_CATEGORY_ORDER } from "./projectDetails/ProjectAffiliations";
import { InfoIcon } from "../../shared/ui/visicIcons";

const LIGHT_BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
  "Housing": "/images/pins/housing.svg",
  "Education": "/images/pins/education.svg",
  "Infrastructure": "/images/pins/infrastructure.svg",
  "Public Resources": "/images/pins/public-resources.svg",
  "Equity & Community Works": "/images/pins/equity-and-community-works.svg",
  "Environmental": "/images/pins/environmental.svg",
  "Public Safety": "/images/pins/public-safety.svg",
  "Economic": "/images/pins/economic.svg",
  "Miscellaneous": "/images/pins/miscellaneous.svg",
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

const MAP_GUIDANCE_ICON_ITEMS = MARKER_CATEGORIES.map((category) => ({
  label: category,
  src: PIN_SRC[category],
}));

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

/** Checkbox that can render the indeterminate (partial) state, which has no React prop. */
function TristateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />;
}

interface CityMapProps {
  boundaries: DistrictBoundaryCollection | null;
  markers: MapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number | null;
  /** Geocoded address from landing; used to zoom before district GeoJSON is ready, and as fallback. */
  addressFocusPoint?: { latitude: number; longitude: number } | null;
  /** When set (geocoded address or landing `districtPinFilter=1` + `districtFocus`), project pin filters default to this district only. */
  addressDrivenDistrictPinsId?: number | null;
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
  addressDrivenDistrictPinsId = null,
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
  const lastDistrictFocusRef = useRef<string | null>(null);
  const prevDistrictOverviewOpenRef = useRef<boolean | undefined>(undefined);
  const lastHandledRefocusSignalRef = useRef(0);
  const lastPillDistrictIdRef = useRef<number | null>(null);
  const pillSwapTimeoutRef = useRef<number | null>(null);
  const [lastVisibleDistrictId, setLastVisibleDistrictId] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [explainedCategory, setExplainedCategory] = useState<MarkerCategory | null>(null);
  const [searchDismissSignal, setSearchDismissSignal] = useState(0);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDistrictFilterOpen, setIsDistrictFilterOpen] = useState(false);
  const [pillPortraitFailed, setPillPortraitFailed] = useState(false);
  const [isDistrictPillVisible, setIsDistrictPillVisible] = useState(true);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<Set<number>>(
    () => new Set(DEFAULT_DISTRICT_IDS),
  );
  const [lastTouchedDistrictId, setLastTouchedDistrictId] = useState<number | null>(null);
  const [selectedBodies, setSelectedBodies] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const hasInitializedCategoryFilterRef = useRef(false);
  const hasInitializedDistrictFilterRef = useRef(false);
  const previousActiveDistrictIdForPillRef = useRef<number | null | undefined>(undefined);

  const availableDistrictIds = useMemo(() => {
    const ids = new Set<number>();
    markers.forEach((marker) => {
      if (marker.districtId != null) {
        ids.add(marker.districtId);
      }
    });
    return (ids.size > 0 ? [...ids] : DEFAULT_DISTRICT_IDS).sort((a, b) => a - b);
  }, [markers]);
  // Specific bodies (e.g. "Fire Department") present on loaded pins, grouped by category in canonical order.
  const availableBodyGroups = useMemo(() => {
    // NB: `Map` is shadowed by the react-map-gl import in this file, so use a plain object.
    const byCategory: Record<string, Set<string>> = {};
    markers.forEach((marker) =>
      marker.affiliations.forEach((group) => {
        const set = (byCategory[group.category] ??= new Set<string>());
        group.items.forEach((name) => set.add(name));
      }),
    );
    const orderedCats = AFFILIATION_CATEGORY_ORDER.filter((category) => category in byCategory);
    const extras = Object.keys(byCategory)
      .filter((category) => !AFFILIATION_CATEGORY_ORDER.includes(category))
      .sort();
    return [...orderedCats, ...extras].map((category) => ({
      category,
      bodies: [...byCategory[category]].sort(),
    }));
  }, [markers]);
  const allBodies = useMemo(() => availableBodyGroups.flatMap((group) => group.bodies), [availableBodyGroups]);
  const visibleMarkers = useMemo(() => {
    // The body filter only narrows once the user deselects something; "all selected" shows every pin
    // (including pins that have no affiliations).
    const bodyFilterActive = allBodies.length > 0 && !allBodies.every((body) => selectedBodies.has(body));
    return markers.filter((marker) => {
      // Always keep the actively-selected project visible (e.g. opened via "View on Map" from the
      // district overview), even if it falls outside the current district/category pin filters.
      if (marker.id === activeMarkerId) {
        return true;
      }
      if (marker.districtId == null || !selectedDistrictIds.has(marker.districtId)) {
        return false;
      }
      if (!bodyFilterActive) {
        return true;
      }
      return marker.affiliations.some((group) => group.items.some((name) => selectedBodies.has(name)));
    });
  }, [markers, selectedDistrictIds, selectedBodies, allBodies, activeMarkerId]);
  const selectedDistrictIdList = useMemo(() => [...selectedDistrictIds], [selectedDistrictIds]);
  const activeFilterDistrictIds = useMemo(
    () => availableDistrictIds.filter((id) => selectedDistrictIds.has(id)),
    [availableDistrictIds, selectedDistrictIds],
  );
  /** Councilmember pill: most recent map focus (`activeDistrictId`) or filter checkbox. No pill when both are cleared (e.g. map background click). */
  const pillDistrictId = useMemo((): number | null => {
    if (activeFilterDistrictIds.length === 0) {
      return null;
    }
    if (lastTouchedDistrictId != null && activeFilterDistrictIds.includes(lastTouchedDistrictId)) {
      return lastTouchedDistrictId;
    }
    if (activeDistrictId != null && activeFilterDistrictIds.includes(activeDistrictId)) {
      return activeDistrictId;
    }
    if (activeDistrictId == null && lastTouchedDistrictId == null) {
      return null;
    }
    return Math.min(...activeFilterDistrictIds);
  }, [activeFilterDistrictIds, lastTouchedDistrictId, activeDistrictId]);

  const { profile: districtProfile } = useDistrictProfile(pillDistrictId);
  const { biosByDistrict } = useCouncilMemberBios();
  const showDistrictPill = pillDistrictId != null;
  const displayedDistrictId = pillDistrictId ?? lastVisibleDistrictId;
  const bio = pillDistrictId != null ? biosByDistrict?.get(pillDistrictId) : undefined;
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

  const mapGuidanceHowToUse = useMemo(
    () => [
      "Hover pins to preview project names.",
      "Click pins to open project details.",
      "Click a district to view its projects.",
    ],
    [],
  );

  const setMapInstance = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    setIsMapReady(Boolean(instance));
  }, []);

  useEffect(() => {
    if (activeDistrictId === previousActiveDistrictIdForPillRef.current) {
      return;
    }
    if (activeDistrictId != null) {
      setLastTouchedDistrictId(activeDistrictId);
    } else if (previousActiveDistrictIdForPillRef.current != null) {
      setLastTouchedDistrictId(null);
    }
    previousActiveDistrictIdForPillRef.current = activeDistrictId;
  }, [activeDistrictId]);

  useEffect(() => {
    if (pillDistrictId != null) {
      setLastVisibleDistrictId(pillDistrictId);
    }
  }, [pillDistrictId]);

  useEffect(() => {
    if (districtOverviewOpen) {
      setIsInfoOpen(false);
      setIsDistrictFilterOpen(false);
    }
  }, [districtOverviewOpen]);

  useEffect(() => {
    if (availableDistrictIds.length === 0) {
      return;
    }

    if (addressDrivenDistrictPinsId != null) {
      setSelectedDistrictIds(new Set([addressDrivenDistrictPinsId]));
      setLastTouchedDistrictId(addressDrivenDistrictPinsId);
      hasInitializedDistrictFilterRef.current = true;
      return;
    }

    if (!hasInitializedDistrictFilterRef.current) {
      setSelectedDistrictIds(new Set(availableDistrictIds));
      hasInitializedDistrictFilterRef.current = true;
    }
  }, [availableDistrictIds, addressDrivenDistrictPinsId]);

  useEffect(() => {
    if (allBodies.length === 0 || hasInitializedCategoryFilterRef.current) {
      return;
    }
    setSelectedBodies(new Set(allBodies));
    hasInitializedCategoryFilterRef.current = true;
  }, [allBodies]);

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
  }, [portraitSrc, pillDistrictId]);

  useEffect(() => {
    return () => {
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pillDistrictId == null) {
      lastPillDistrictIdRef.current = null;
      setIsDistrictPillVisible(false);
      if (pillSwapTimeoutRef.current != null) {
        window.clearTimeout(pillSwapTimeoutRef.current);
        pillSwapTimeoutRef.current = null;
      }
      return;
    }

    const previousDistrictId = lastPillDistrictIdRef.current;
    lastPillDistrictIdRef.current = pillDistrictId;

    if (previousDistrictId == null || previousDistrictId === pillDistrictId) {
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
  }, [pillDistrictId]);

  useLayoutEffect(() => {
    const overviewWasOpen = prevDistrictOverviewOpenRef.current;

    try {
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

          if (districtOverviewOpen) {
            const framingKey = `${activeDistrictId}:sheet`;
            if (!shouldForceRefocus && overviewWasOpen === true && lastDistrictFocusRef.current === framingKey) {
              return;
            }
            lastDistrictFocusRef.current = framingKey;
            const bottomPad = Math.max(220, Math.round(window.innerHeight * 0.44));
            map.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: { top: 96, bottom: bottomPad, left: 72, right: 72 },
                maxZoom: 14,
                minZoom: 8.8,
                duration: 0,
              },
            );
            return;
          }

          if (overviewWasOpen === true && !shouldForceRefocus) {
            lastDistrictFocusRef.current = `${activeDistrictId}:post-sheet`;
            return;
          }

          const postSheetKey = `${activeDistrictId}:post-sheet`;
          if (lastDistrictFocusRef.current === postSheetKey) {
            return;
          }

          const framingKey = `${activeDistrictId}:full`;
          if (!shouldForceRefocus && lastDistrictFocusRef.current === framingKey) {
            return;
          }
          lastDistrictFocusRef.current = framingKey;
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            {
              padding: { top: 96, bottom: 96, left: 72, right: 72 },
              maxZoom: 14,
              minZoom: 8.8,
              duration: 0,
            },
          );
          return;
        }
      }

      if (addressFocusPoint) {
        map.jumpTo({
          center: [addressFocusPoint.longitude, addressFocusPoint.latitude],
          zoom: Math.max(map.getZoom(), 12.8),
        });
      }
    } finally {
      prevDistrictOverviewOpenRef.current = districtOverviewOpen;
    }
  }, [activeDistrictId, boundaries, addressFocusPoint, districtRefocusSignal, districtOverviewOpen, isMapReady]);

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
      return;
    }

    const districtValue = clickedFeature.properties?.District;
    const parsedDistrictId = Number(districtValue);
    if (Number.isNaN(parsedDistrictId)) {
      return;
    }

    setSelectedDistrictIds(new Set([parsedDistrictId]));
    hasInitializedDistrictFilterRef.current = true;
    onDistrictSelect(parsedDistrictId);
  }

  return (
    <div className="city-demo-map">
      <Map
        ref={setMapInstance}
        initialViewState={DEFAULT_VIEW_STATE}
        onClick={handleMapClick}
        interactiveLayerIds={[
          "district-fill-dim",
          "district-fill-selected",
          "district-highlight",
          "district-labels",
        ]}
        mapStyle={LIGHT_BASE_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {boundaries ? (
          <Source id="district-boundaries" type="geojson" data={boundaries}>
            <Layer {...buildDistrictFillDimLayer()} />
            <Layer {...buildDistrictFillLayer(selectedDistrictIdList)} />
            <Layer {...districtOutlineLayer} />
            {pillDistrictId != null ? <Layer {...buildHighlightLayer(pillDistrictId)} /> : null}
            <Layer {...districtLabelsLayer} />
          </Source>
        ) : null}

        {visibleMarkers.map((marker) => {
          const showHoverCard = hoveredMarkerId === marker.id;
          const markerZIndex = activeMarkerId === marker.id ? 4 : showHoverCard ? 6 : 1;
          const titleColor = CATEGORY_COLOR[marker.category];
          const pinSrc = PIN_SRC[marker.category];
          const markerCouncilNameRaw =
            marker.districtId != null ? biosByDistrict?.get(marker.districtId)?.name?.trim() || "" : "";
          const markerCouncilName = markerCouncilNameRaw ? formatPersonNameForDisplay(markerCouncilNameRaw) : null;

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
                      {marker.primaryAddress?.trim() ? (
                        <span className="map-marker-hover-address">{marker.primaryAddress}</span>
                      ) : null}
                      {markerCouncilName || marker.districtId != null ? (
                        <span className="map-marker-hover-member">
                          {markerCouncilName ?? "Council Member"}
                          {marker.districtId != null ? ` · District ${marker.districtId}` : ""}
                        </span>
                      ) : null}
                      {marker.affiliations.length > 0 ? (
                        <span className="map-marker-hover-chips">
                          <ProjectAffiliationChips affiliations={marker.affiliations} density="comfortable" />
                        </span>
                      ) : null}
                      <span className="map-marker-hover-cta">Click to learn more.</span>
                    </span>
                  ) : null}
                  <span className={`map-marker-pin-visual ${showHoverCard ? "is-hovered" : ""}`.trim()}>
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
                  </span>
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
          showDistrictPill && !districtOverviewOpen && isDistrictPillVisible && !isSearchExpanded
            ? "is-visible"
            : "is-hidden"
        }${hideMapChrome ? " map-district-pill-shell--elevated" : ""}`}
      >
        <span className="project-sidebar-tool-btn-with-hint">
          <button
            type="button"
            className="map-district-pill"
            onClick={() => {
              if (pillDistrictId != null) {
                onOpenDistrictOverview(pillDistrictId);
              }
            }}
            aria-label={pillDistrictId != null ? `Open District ${pillDistrictId} overview` : "District overview hidden"}
            aria-hidden={showDistrictPill && !districtOverviewOpen ? undefined : true}
            tabIndex={showDistrictPill && !districtOverviewOpen ? 0 : -1}
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
          <span className="project-sidebar-tool-btn-hint" aria-hidden="true">
            District Overview
          </span>
        </span>
      </div>

      {districtOverviewOpen || hideMapChrome ? null : (
        <>
          <div className="map-search-dock">
            <MapAddressSearch dismissSignal={searchDismissSignal} onExpandedChange={setIsSearchExpanded} />
          </div>

          <div className="map-control-stack map-control-stack--figma" aria-label="Map controls">
            <div className="map-figma-controls-wrap">
              <div className="map-control-pill map-control-pill--stacked">
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Filter Coming Soon
                  </span>
                  <button type="button" className="map-figma-ctrl-btn" aria-label="Map filter (coming soon)">
                    <img src="/menu-icon.svg" alt="" width={18} height={12} />
                  </button>
                </span>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Accessibility
                  </span>
                  <button
                    type="button"
                    className={`map-figma-ctrl-btn ${isInfoOpen ? "is-active" : ""}`}
                    aria-label="Toggle accessibility information"
                    aria-expanded={isInfoOpen}
                    onClick={() => {
                      setIsInfoOpen((current) => !current);
                      setIsDistrictFilterOpen(false);
                    }}
                  >
                    <InfoIcon className="map-figma-info-icon" width={18} height={18} aria-hidden />
                  </button>
                </span>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    District Filters
                  </span>
                  <button
                    type="button"
                    className={`map-figma-ctrl-btn ${isDistrictFilterOpen ? "is-active" : ""}`}
                    aria-label="Filter projects by district"
                    aria-expanded={isDistrictFilterOpen}
                    onClick={() => {
                      setIsDistrictFilterOpen((current) => !current);
                      setIsInfoOpen(false);
                    }}
                  >
                    <span className="map-figma-filter-label" aria-hidden>
                      CD
                    </span>
                  </button>
                </span>
              </div>

              <div className="map-control-pill map-control-pill--stacked">
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Zoom In
                  </span>
                  <button
                    type="button"
                    className="map-figma-ctrl-btn"
                    aria-label="Zoom in"
                    onClick={() => handleZoom(0.65)}
                  >
                    <img src="/zoom-in-icon.svg" alt="" width={18} height={18} />
                  </button>
                </span>
                <span className="map-control-pill-rule" aria-hidden="true" />
                <span className="map-figma-ctrl-tooltip-wrap">
                  <span className="map-figma-ctrl-tooltip" aria-hidden="true">
                    Zoom Out
                  </span>
                  <button
                    type="button"
                    className="map-figma-ctrl-btn"
                    aria-label="Zoom out"
                    onClick={() => handleZoom(-0.65)}
                  >
                    <img src="/zoom-out-icon.svg" alt="" width={18} height={18} />
                  </button>
                </span>
              </div>

              {isInfoOpen ? (
                <div className="map-figma-flyout map-figma-flyout--info" aria-label="Accessibility information">
                  <div className="map-guidance-topbar">
                    <span className="map-guidance-topbar-title">Accessibility</span>
                    <button
                      type="button"
                      className="map-guidance-close-btn"
                      aria-label="Close map guidance"
                      onClick={() => setIsInfoOpen(false)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>

                  <div className="map-guidance-sections">
                    <section className="map-guidance-section" aria-label="Map guidance: map">
                      <h4 className="map-guidance-section-title">Map</h4>
                      <p className="map-guidance-section-body">
                        Use the district overlays for geographic context and the project markers for quick detail checks.
                      </p>
                    </section>

                    <section className="map-guidance-section" aria-label="Map guidance: icons">
                      <h4 className="map-guidance-section-title">Icons</h4>
                      <div className="map-guidance-icons" role="list" aria-label="Map icon legend">
                        {MAP_GUIDANCE_ICON_ITEMS.map((item) => {
                          const isExplained = explainedCategory === item.label;
                          return (
                            <div key={item.label} className="map-guidance-icon-item" role="listitem">
                              <div className="map-guidance-icon-head">
                                <img
                                  className="map-guidance-icon-img"
                                  src={item.src}
                                  alt=""
                                  width={26}
                                  height={32}
                                  draggable={false}
                                />
                                <span className="map-guidance-icon-label">{item.label}</span>
                              </div>
                              <button
                                type="button"
                                className="map-guidance-icon-explain"
                                aria-expanded={isExplained}
                                onClick={() =>
                                  setExplainedCategory((current) => (current === item.label ? null : item.label))
                                }
                              >
                                What does this mean
                              </button>
                              {isExplained ? (
                                <p className="map-guidance-icon-description">{categoryDescription(item.label)}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="map-guidance-section" aria-label="Map guidance: how to use">
                      <h4 className="map-guidance-section-title">How to Use</h4>
                      <div className="map-guidance-section-body map-guidance-howto">
                        {mapGuidanceHowToUse.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </section>
                  </div>
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
                      onClick={() => {
                        setLastTouchedDistrictId(null);
                        setSelectedDistrictIds(new Set<number>());
                      }}
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
                            setLastTouchedDistrictId(districtId);
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

                  {availableBodyGroups.length > 0 ? (
                    <div className="map-district-filter-categories">
                      <div className="map-utility-header">
                        <strong>Categories</strong>
                        <span>Pins</span>
                      </div>
                      <p>Filter pins by the specific bodies (committees, departments, etc.) involved.</p>
                      <div className="map-district-filter-actions" role="group" aria-label="Category filter quick actions">
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedBodies(new Set(allBodies))}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="map-district-filter-action-btn"
                          onClick={() => setSelectedBodies(new Set<string>())}
                        >
                          Deselect all
                        </button>
                      </div>
                      <div className="map-category-filter-list">
                        {availableBodyGroups.map((group) => {
                          const allSelected = group.bodies.every((body) => selectedBodies.has(body));
                          const someSelected = group.bodies.some((body) => selectedBodies.has(body));
                          const isExpanded = expandedCategories.has(group.category);
                          return (
                            <div key={group.category} className="map-category-filter-group">
                              <div className="map-category-filter-head">
                                <label className="map-district-filter-option map-category-filter-head-label">
                                  <TristateCheckbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={() =>
                                      setSelectedBodies((current) => {
                                        const next = new Set(current);
                                        if (allSelected) {
                                          group.bodies.forEach((body) => next.delete(body));
                                        } else {
                                          group.bodies.forEach((body) => next.add(body));
                                        }
                                        return next;
                                      })
                                    }
                                  />
                                  <span>{group.category}</span>
                                </label>
                                <button
                                  type="button"
                                  className="map-category-filter-toggle"
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? "See less of" : "See more of"} ${group.category}`}
                                  onClick={() =>
                                    setExpandedCategories((current) => {
                                      const next = new Set(current);
                                      if (next.has(group.category)) {
                                        next.delete(group.category);
                                      } else {
                                        next.add(group.category);
                                      }
                                      return next;
                                    })
                                  }
                                >
                                  {isExpanded ? "See less" : "See more"}
                                </button>
                              </div>
                              {isExpanded ? (
                              <div className="map-category-filter-items">
                                {group.bodies.map((body) => (
                                  <label key={body} className="map-district-filter-option">
                                    <input
                                      type="checkbox"
                                      checked={selectedBodies.has(body)}
                                      onChange={() =>
                                        setSelectedBodies((current) => {
                                          const next = new Set(current);
                                          if (next.has(body)) {
                                            next.delete(body);
                                          } else {
                                            next.add(body);
                                          }
                                          return next;
                                        })
                                      }
                                    />
                                    <span>{body}</span>
                                  </label>
                                ))}
                              </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
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
