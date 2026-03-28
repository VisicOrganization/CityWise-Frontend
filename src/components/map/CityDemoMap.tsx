import { useEffect, useState } from "react";
import Map, { Layer, Marker, Source, type MapLayerMouseEvent, type ViewState } from "react-map-gl/maplibre";

import type { DistrictBoundaryCollection } from "../../lib/districtBoundaries";
import { categoryAppearance, getDemoDistrict, type DemoMapMarker } from "../../lib/mock/mapDemo";
import { districtFillLayer, districtOutlineLayer } from "../../lib/map/districtLayers";


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
  boundaries: DistrictBoundaryCollection | null;
  markers: DemoMapMarker[];
  activeMarkerId?: string | null;
  activeDistrictId: number;
  searchQuery: string;
  searchResults: string[];
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectResult: (label: string) => void;
  onMarkerSelect: (marker: DemoMapMarker) => void;
  onDistrictSelect: (districtId: number) => void;
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
  const activeDistrict = getDemoDistrict(activeDistrictId);

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
      return;
    }

    const districtValue = clickedFeature.properties?.District;
    const parsedDistrictId = Number(districtValue);
    if (Number.isNaN(parsedDistrictId)) {
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
        mapStyle={DEMO_MAP_STYLE}
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

      <div className="map-district-pill">
        <span className="map-district-avatar">{activeDistrict.representative.split(" ").map((part) => part[0]).join("")}</span>
        <span>
          {activeDistrict.representative} • {activeDistrict.label}
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
