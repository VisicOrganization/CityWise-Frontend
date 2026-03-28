import { useEffect, useState } from "react";
import Map, { Marker, type ViewState } from "react-map-gl/maplibre";

import { categoryAppearance, demoDistrict, demoMapMarkers, type DemoMapMarker } from "../../lib/mock/mapDemo";


const DEMO_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-base",
      type: "raster",
      source: "osm",
      paint: {
        "raster-opacity": 0.96,
        "raster-saturation": -0.35,
      },
    },
  ],
} as const;

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.575,
  latitude: 34.225,
  zoom: 12.2,
  bearing: 0,
  pitch: 0,
};

interface CityDemoMapProps {
  markers?: DemoMapMarker[];
  activeMarkerId?: string | null;
  searchQuery: string;
  searchResults: string[];
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectResult: (label: string) => void;
  onMarkerSelect: (marker: DemoMapMarker) => void;
}


export function CityDemoMap({
  markers = demoMapMarkers,
  activeMarkerId,
  searchQuery,
  searchResults,
  onSearchChange,
  onSearchSubmit,
  onSelectResult,
  onMarkerSelect,
}: CityDemoMapProps) {
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);

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

  return (
    <div className="city-demo-map">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapStyle={DEMO_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
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
            <div className="demo-marker-label">{marker.label}</div>
          </Marker>
        ))}
      </Map>

      <div className="map-district-pill">
        <span className="map-district-avatar">{demoDistrict.representative.split(" ").map((part) => part[0]).join("")}</span>
        <span>
          {demoDistrict.representative} • {demoDistrict.label}
        </span>
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
        <button type="button">☰</button>
        <button type="button">ⓘ</button>
        <button type="button">＋</button>
        <button type="button">－</button>
      </div>
    </div>
  );
}
