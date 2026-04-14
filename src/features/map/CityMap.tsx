import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type ViewState,
} from "react-map-gl/maplibre";

import { MapAddressSearch } from "./MapAddressSearch";
import { useCouncilMemberBios } from "../districts/useCouncilMemberBios";
import { useDistrictProfile } from "../districts/useDistrictProfile";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { findDistrictFeature, getFeatureBounds, type DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import { districtFillLayer, districtHighlightLayer, districtOutlineLayer } from "../../shared/map/districtLayers";
import type { MapMarker, MarkerCategory } from "../../shared/map/mapTypes";
import { InfoIcon } from "../../shared/ui/visicIcons";

const LIGHT_BASE_MAP_STYLE = {
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
} as const;

const PIN_SRC: Record<MarkerCategory, string> = {
  housing: "/images/pins/brown-pin.svg",
  transit: "/images/pins/blue-pin.svg",
  parks: "/images/pins/green-pin.svg",
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
};

function buildHighlightLayer(activeDistrictId: number) {
  return {
    ...districtHighlightLayer,
    filter: ["==", ["get", "District"], activeDistrictId] as ["==", ["get", string], number],
  } satisfies typeof districtHighlightLayer;
}

interface CityMapProps {
  boundaries: DistrictBoundaryCollection | null;
  markers: MapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number | null;
  /** Geocoded address from landing; used to zoom before district GeoJSON is ready, and as fallback. */
  addressFocusPoint?: { latitude: number; longitude: number } | null;
  /** Query / focus label for the searched address (accessibility + tooltip). */
  addressFocusLabel?: string | null;
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
  addressFocusLabel = null,
  districtOverviewOpen = false,
  onMarkerSelect,
  onMapBackgroundClick,
  onOpenDistrictOverview,
  onDistrictSelect,
}: CityMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const lastDistrictFocusRef = useRef<number | null>(null);
  /** Previous `districtOverviewOpen` (layout phase); detect sheet close to re-fit the map to the district. */
  const prevDistrictOverviewOpenRef = useRef<boolean | null>(null);
  const [lastVisibleDistrictId, setLastVisibleDistrictId] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [addressFocusPinHovered, setAddressFocusPinHovered] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [pillPortraitFailed, setPillPortraitFailed] = useState(false);

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

  useEffect(() => {
    if (activeDistrictId) {
      setLastVisibleDistrictId(activeDistrictId);
    }
  }, [activeDistrictId]);

  useEffect(() => {
    if (districtOverviewOpen) {
      setIsInfoOpen(false);
      setIsMenuOpen(false);
    }
  }, [districtOverviewOpen]);

  useEffect(() => {
    setPillPortraitFailed(false);
  }, [portraitSrc, activeDistrictId]);

  useEffect(() => {
    if (!addressFocusPoint) {
      setAddressFocusPinHovered(false);
    }
  }, [addressFocusPoint]);

  useLayoutEffect(() => {
    const prevOverviewOpen = prevDistrictOverviewOpenRef.current;
    prevDistrictOverviewOpenRef.current = districtOverviewOpen;
    const districtOverviewJustClosed = prevOverviewOpen === true && !districtOverviewOpen;

    if (districtOverviewJustClosed && activeDistrictId != null) {
      lastDistrictFocusRef.current = null;
    }

    /* While the council member sheet is open, avoid driving the camera (sheet covers the map). */
    if (districtOverviewOpen) {
      return;
    }

    if (activeDistrictId == null) {
      lastDistrictFocusRef.current = null;
      if (addressFocusPoint) {
        setViewState((current) => ({
          ...current,
          longitude: addressFocusPoint.longitude,
          latitude: addressFocusPoint.latitude,
          zoom: Math.max(current.zoom, 12.8),
        }));
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
          setViewState((current) => ({
            ...current,
            longitude: centerLng,
            latitude: centerLat,
          }));
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
        setViewState((current) => ({
          ...current,
          longitude: centerLng,
          latitude: centerLat,
          zoom: focusZoom,
        }));
        return;
      }
    }

    if (addressFocusPoint) {
      setViewState((current) => ({
        ...current,
        longitude: addressFocusPoint.longitude,
        latitude: addressFocusPoint.latitude,
        zoom: Math.max(current.zoom, 12.8),
      }));
    }
  }, [activeDistrictId, boundaries, addressFocusPoint, districtOverviewOpen]);

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
        ref={mapRef}
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        onClick={handleMapClick}
        interactiveLayerIds={["district-fill"]}
        mapStyle={LIGHT_BASE_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {boundaries ? (
          <Source id="district-boundaries" type="geojson" data={boundaries}>
            <Layer
              {...districtFillLayer}
              {...(activeDistrictId != null
                ? {
                    filter: ["!=", ["get", "District"], activeDistrictId] as [
                      "!=",
                      ["get", string],
                      number,
                    ],
                  }
                : {})}
            />
            <Layer {...districtOutlineLayer} />
            {activeDistrictId != null ? <Layer {...buildHighlightLayer(activeDistrictId)} /> : null}
          </Source>
        ) : null}

        {markers.map((marker) => {
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
                      <span className="map-marker-hover-title">{marker.label}</span>
                      {marker.summary.trim() ? (
                        <p className="map-marker-hover-summary">{marker.summary}</p>
                      ) : null}
                      <span className="map-marker-hover-cta">Click to learn more.</span>
                    </span>
                  ) : null}
                  <img
                    className="map-marker-pin-img"
                    src={pinSrc}
                    alt=""
                    width={39}
                    height={48}
                    draggable={false}
                  />
                  <span className="map-marker-side-title" style={{ color: titleColor }}>
                    {marker.label}
                  </span>
                </span>
              </button>
            </Marker>
          );
        })}
        {addressFocusPoint ? (
          <Marker
            longitude={addressFocusPoint.longitude}
            latitude={addressFocusPoint.latitude}
            anchor="bottom"
            style={{ zIndex: addressFocusPinHovered ? 7 : 6 }}
          >
            <button
              type="button"
              className={`map-address-search-pin demo-marker ${addressFocusPinHovered ? "marker-active" : ""}`}
              aria-label={addressFocusLabel?.trim() || "Your searched address"}
              onMouseEnter={() => setAddressFocusPinHovered(true)}
              onMouseLeave={() => setAddressFocusPinHovered(false)}
              onFocus={() => setAddressFocusPinHovered(true)}
              onBlur={() => setAddressFocusPinHovered(false)}
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={`${import.meta.env.BASE_URL}CityWiseLogoNoBG.png`}
                alt=""
                width={40}
                height={48}
                decoding="async"
              />
              {addressFocusPinHovered ? (
                <span className="demo-marker-label">
                  {addressFocusLabel?.trim() || "Searched address"}
                </span>
              ) : null}
            </button>
          </Marker>
        ) : null}
      </Map>

      <div
        className={`map-district-pill-shell ${activeDistrict && !districtOverviewOpen ? "is-visible" : "is-hidden"}`}
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

      {districtOverviewOpen ? null : (
        <>
          <div className="map-search-dock">
            <MapAddressSearch dismissSignal={searchDismissSignal} />
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
                  }}
                >
                  <InfoIcon className="map-figma-info-icon" width={18} height={18} aria-hidden />
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
