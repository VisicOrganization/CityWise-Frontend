import { useEffect, useMemo, useState } from "react";
import Map, { Layer, Marker, Source, type MapLayerMouseEvent, type ViewState } from "react-map-gl/maplibre";
import { useNavigate } from "react-router-dom";

import type { DistrictBoundaryCollection } from "../../lib/districtBoundaries";
import { categoryAppearance, getDemoDistrict, type DemoMapMarker } from "../../lib/mock/mapDemo";
import { districtFillLayer, districtOutlineLayer } from "../../lib/map/districtLayers";


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

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.575,
  latitude: 34.225,
  zoom: 12.2,
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
  const navigate = useNavigate();
  const activeDistrict = activeDistrictId ? getDemoDistrict(activeDistrictId) : null;
  const mapStyle = useMemo(() => buildBaseMapStyle(baseMapId), [baseMapId]);

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
        {boundaries ? (
          <Source id="demo-district-boundaries" type="geojson" data={boundaries}>
            <Layer {...districtFillLayer} />
            <Layer {...districtOutlineLayer} />
          </Source>
        ) : null}

        {markers.map((marker) => (
          <Marker key={marker.id} longitude={marker.longitude} latitude={marker.latitude} anchor="bottom">
            <button
              type="button"
              className={`demo-marker ${categoryAppearance[marker.category].className} ${marker.kind === "search" ? "marker-search-hit" : ""} ${activeMarkerId === marker.id ? "marker-active" : ""}`}
              aria-label={marker.label}
              onClick={() => onMarkerSelect(marker)}
            >
              <span className="demo-marker-icon">{categoryAppearance[marker.category].icon}</span>
            </button>
            {marker.kind === "search" || activeMarkerId === marker.id ? (
              <div className="demo-marker-label">{marker.label}</div>
            ) : null}
          </Marker>
        ))}
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
          aria-label={activeDistrict ? `Open ${activeDistrict.label} overview` : "No district selected"}
          aria-hidden={activeDistrict ? undefined : true}
          tabIndex={activeDistrict ? 0 : -1}
        >
          <span className="map-district-avatar">
            {activeDistrict ? activeDistrict.representative.split(" ").map((part) => part[0]).join("") : "?"}
          </span>
          <span>
            {activeDistrict ? `${activeDistrict.representative} • ${activeDistrict.label}` : "Select a district"}
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
          ⌕
        </button>
        <div className="map-search-panel">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search query"
            placeholder="Search an address or place"
          />
          <div className="map-search-results">
            {searchResults.map((result) => (
              <button key={result} type="button" onClick={() => onSelectResult(result)}>
                {result}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="map-control-stack" aria-label="Map controls">
        <label className="map-basemap-select">
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
        </label>
        <button type="button">☰</button>
        <button type="button">ⓘ</button>
        <button type="button">＋</button>
        <button type="button">－</button>
      </div>
    </div>
  );
}
