import { useEffect, useMemo, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type ViewState,
} from "react-map-gl/maplibre";
import { useNavigate } from "react-router-dom";

import type { DistrictBoundaryCollection } from "../../shared/map/districtBoundaries";
import { districtFillLayer, districtOutlineLayer } from "../../shared/map/districtLayers";
import { categoryAppearance, getDemoDistrict, type DemoMapMarker } from "../../shared/mock/mapDemo";
import {
  FilterIcon,
  HousingIcon,
  InfoIcon,
  InfrastructureIcon,
  SearchIcon,
  TransitIcon,
} from "../../shared/ui/visicIcons";


const baseMaps = {
  streets: {
    label: "Streets",
    background: "#f5f0e8",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  },
  light: {
    label: "Light",
    background: "#eef2f5",
    tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
  },
  dark: {
    label: "Dark",
    background: "#0f172a",
    tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
  },
} as const;

type BaseMapId = keyof typeof baseMaps;

type MarkerCategory = DemoMapMarker["category"];

const categoryLabels: Record<MarkerCategory, string> = {
  housing: "Housing",
  transit: "Transportation",
  parks: "Infrastructure",
};

function buildBaseMapStyle(baseMapId: BaseMapId) {
  const baseMap = baseMaps[baseMapId];

  return {
    version: 8,
    sources: {
      raster: {
        type: "raster",
        tiles: baseMap.tiles,
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": baseMap.background,
        },
      },
      {
        id: "raster-base",
        type: "raster",
        source: "raster",
        paint: {
          "raster-opacity": baseMapId === "dark" ? 0.94 : 0.97,
          "raster-saturation": baseMapId === "streets" ? -0.35 : -0.18,
        },
      },
    ],
  } as const;
}

function CategoryMarkerIcon({ category }: { category: MarkerCategory }) {
  const props = { className: "demo-marker-icon", width: 20, height: 20 };

  if (category === "housing") {
    return <HousingIcon {...props} />;
  }

  if (category === "transit") {
    return <TransitIcon {...props} />;
  }

  return <InfrastructureIcon {...props} />;
}

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.4118,
  latitude: 34.021,
  zoom: 8.8,
  bearing: 0,
  pitch: 0,
};

interface CityDemoMapProps {
  boundaries: DistrictBoundaryCollection | null;
  markers: DemoMapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number | null;
  searchQuery: string;
  searchResults: string[];
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectResult: (label: string) => void;
  onMarkerSelect: (marker: DemoMapMarker) => void;
  onDistrictSelect: (districtId: number | null) => void;
}


export function CityDemoMap({
  boundaries,
  markers,
  activeMarkerId,
  activeDistrictId,
  searchQuery,
  searchResults,
  onSearchChange,
  onSearchSubmit,
  onSelectResult,
  onMarkerSelect,
  onDistrictSelect,
}: CityDemoMapProps) {
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);
  const [baseMapId, setBaseMapId] = useState<BaseMapId>("streets");
  const [lastVisibleDistrictId, setLastVisibleDistrictId] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [filterState, setFilterState] = useState<Record<MarkerCategory, boolean>>({
    housing: true,
    transit: true,
    parks: true,
  });
  const navigate = useNavigate();
  const activeDistrict = activeDistrictId ? getDemoDistrict(activeDistrictId) : null;
  const displayedDistrict = getDemoDistrict(activeDistrictId ?? lastVisibleDistrictId ?? undefined);
  const mapStyle = useMemo(() => buildBaseMapStyle(baseMapId), [baseMapId]);

  useEffect(() => {
    if (activeDistrictId) {
      setLastVisibleDistrictId(activeDistrictId);
    }
  }, [activeDistrictId]);

  useEffect(() => {
    const searchMarker = markers.find((marker) => marker.kind === "search");
    if (!searchMarker) {
      return;
    }

    setViewState((current) => ({
      ...current,
      longitude: searchMarker.longitude,
      latitude: searchMarker.latitude,
      zoom: Math.max(current.zoom, 13.2),
    }));
  }, [markers]);

  function handleMapClick(event: MapLayerMouseEvent) {
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
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        onClick={handleMapClick}
        interactiveLayerIds={["district-fill"]}
        mapStyle={mapStyle}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {boundaries ? (
          <Source id="demo-district-boundaries" type="geojson" data={boundaries}>
            <Layer {...districtFillLayer} />
            <Layer {...districtOutlineLayer} />
          </Source>
        ) : null}

        {markers.map((marker) => {
          const showLabel = marker.kind === "search" || activeMarkerId === marker.id || hoveredMarkerId === marker.id;
          const isMuted = !filterState[marker.category];

          return (
            <Marker key={marker.id} longitude={marker.longitude} latitude={marker.latitude} anchor="bottom">
              <div className="marker-stack">
                <button
                  type="button"
                  className={`demo-marker ${categoryAppearance[marker.category].className} ${marker.kind === "search" ? "marker-search-hit" : ""} ${activeMarkerId === marker.id ? "marker-active" : ""} ${isMuted ? "marker-muted" : ""}`}
                  aria-label={marker.label}
                  onMouseEnter={() => setHoveredMarkerId(marker.id)}
                  onMouseLeave={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                  onFocus={() => setHoveredMarkerId(marker.id)}
                  onBlur={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkerSelect(marker);
                  }}
                >
                  <CategoryMarkerIcon category={marker.category} />
                </button>
                {showLabel ? (
                  <div className="demo-marker-label">
                    <span>{marker.label}</span>
                  </div>
                ) : null}
              </div>
            </Marker>
          );
        })}
      </Map>

      <div className={`map-district-pill-shell ${activeDistrict ? "is-visible" : "is-hidden"}`}>
        <button
          type="button"
          className="map-district-pill"
          onClick={() => {
            if (activeDistrict) {
              navigate(`/districts/${activeDistrict.id}`);
            }
          }}
          aria-label={activeDistrict ? `Open District ${activeDistrict.id} overview` : "District overview hidden"}
          aria-hidden={activeDistrict ? undefined : true}
          tabIndex={activeDistrict ? 0 : -1}
        >
          <span className="map-district-avatar">
            {displayedDistrict.representative.split(" ").map((part) => part[0]).join("")}
          </span>
          <span>
            {`${displayedDistrict.representative} • ${displayedDistrict.label}`}
          </span>
        </button>
      </div>

      <form
        className="map-search-dock"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <button type="submit" className="map-search-icon" aria-label="Search map">
          <SearchIcon />
        </button>
        <div className="map-search-panel">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search query"
            placeholder="Search an address or place"
          />
          {searchResults.length > 0 ? (
            <div className="map-search-results">
              {searchResults.map((result) => (
                <button key={result} type="button" onClick={() => onSelectResult(result)}>
                  {result}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </form>

      <div className="map-control-stack" aria-label="Map controls">
        <div className="map-basemap-select">
          <span>Basemap</span>
          <select
            aria-label="Basemap style"
            value={baseMapId}
            onChange={(event) => setBaseMapId(event.target.value as BaseMapId)}
          >
            {Object.entries(baseMaps).map(([id, option]) => (
              <option key={id} value={id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="map-menu-shell">
          <button
            type="button"
            className={`map-utility-button ${isFilterOpen ? "is-active" : ""}`}
            aria-label="Toggle filters"
            aria-expanded={isFilterOpen}
            onClick={() => {
              setIsFilterOpen((current) => !current);
              setIsInfoOpen(false);
            }}
          >
            <FilterIcon />
          </button>
          {isFilterOpen ? (
            <div className="map-utility-panel" aria-label="Filter menu">
              <div className="map-utility-header">
                <strong>Project categories</strong>
                <span>Preview only</span>
              </div>
              {Object.entries(categoryLabels).map(([category, label]) => (
                <label key={category} className="map-filter-row">
                  <input
                    type="checkbox"
                    checked={filterState[category as MarkerCategory]}
                    onChange={() =>
                      setFilterState((current) => ({
                        ...current,
                        [category]: !current[category as MarkerCategory],
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="map-menu-shell">
          <button
            type="button"
            className={`map-utility-button ${isInfoOpen ? "is-active" : ""}`}
            aria-label="Toggle accessibility information"
            aria-expanded={isInfoOpen}
            onClick={() => {
              setIsInfoOpen((current) => !current);
              setIsFilterOpen(false);
            }}
          >
            <InfoIcon />
          </button>
          {isInfoOpen ? (
            <div className="map-utility-panel" aria-label="Accessibility information">
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
    </div>
  );
}
