import { useState } from "react";
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


function DemoMarker({ marker }: { marker: DemoMapMarker }) {
  const appearance = categoryAppearance[marker.category];

  return (
    <Marker longitude={marker.longitude} latitude={marker.latitude} anchor="bottom">
      <button type="button" className={`demo-marker ${appearance.className}`} aria-label={marker.label}>
        <span className="demo-marker-icon">{appearance.icon}</span>
      </button>
      <div className="demo-marker-label">{marker.label}</div>
    </Marker>
  );
}


export function CityDemoMap() {
  const [viewState, setViewState] = useState(DEFAULT_VIEW_STATE);

  return (
    <div className="city-demo-map">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapStyle={DEMO_MAP_STYLE}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {demoMapMarkers.map((marker) => (
          <DemoMarker key={marker.id} marker={marker} />
        ))}
      </Map>

      <div className="map-district-pill">
        <span className="map-district-avatar">{demoDistrict.representative.split(" ").map((part) => part[0]).join("")}</span>
        <span>
          {demoDistrict.representative} • {demoDistrict.label}
        </span>
      </div>

      <div className="map-search-dock">
        <button type="button" className="map-search-icon" aria-label="Search map">
          ⌕
        </button>
        <div className="map-search-panel">
          <input type="text" value="3096" readOnly aria-label="Search query" />
          <div className="map-search-results">
            <button type="button">3096 McClintock Ave</button>
            <button type="button">3096 Lake Hollywood Dr</button>
            <button type="button">3096 N Clybourn Ave</button>
            <button type="button">3096 W Temple Ave</button>
          </div>
        </div>
      </div>

      <div className="map-control-stack" aria-label="Map controls">
        <button type="button">☰</button>
        <button type="button">ⓘ</button>
        <button type="button">＋</button>
        <button type="button">－</button>
      </div>
    </div>
  );
}
