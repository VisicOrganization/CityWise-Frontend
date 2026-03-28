import { useEffect, useState } from "react";
import Map, { Layer, NavigationControl, Source, type ViewState } from "react-map-gl/maplibre";

import {
  findDistrictFeature,
  getFeatureBounds,
  loadDistrictBoundaries,
  type DistrictBoundaryCollection,
} from "../../lib/districtBoundaries";
import {
  citywiseBaseStyle,
  districtFillLayer,
  districtHighlightLayer,
  districtOutlineLayer,
} from "../../lib/map/districtLayers";


const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -118.315,
  latitude: 34.05,
  zoom: 9.2,
  bearing: 0,
  pitch: 0,
  padding: {
    top: 24,
    bottom: 24,
    left: 24,
    right: 24,
  },
};


interface DistrictMapProps {
  activeDistrictId: number;
}


function buildHighlightLayer(activeDistrictId: number) {
  return {
    ...districtHighlightLayer,
    filter: ["==", ["get", "District"], activeDistrictId] as ["==", ["get", string], number],
  } satisfies typeof districtHighlightLayer;
}


export function DistrictMap({ activeDistrictId }: DistrictMapProps) {
  const [boundaries, setBoundaries] = useState<DistrictBoundaryCollection | null>(null);
  const [viewState, setViewState] = useState<ViewState>(DEFAULT_VIEW_STATE);

  useEffect(() => {
    let ignore = false;

    loadDistrictBoundaries()
      .then((loaded) => {
        if (ignore) {
          return;
        }

        setBoundaries(loaded);

        const feature = findDistrictFeature(loaded, activeDistrictId);
        if (!feature) {
          return;
        }

        const [[minLng, minLat], [maxLng, maxLat]] = getFeatureBounds(feature);
        setViewState((current) => ({
          ...current,
          longitude: (minLng + maxLng) / 2,
          latitude: (minLat + maxLat) / 2,
          zoom: current.zoom,
        }));
      })
      .catch(() => {
        if (!ignore) {
          setBoundaries(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeDistrictId]);

  return (
    <div className="district-map-shell">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapStyle={citywiseBaseStyle}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {boundaries ? (
          <Source id="district-boundaries" type="geojson" data={boundaries}>
            <Layer {...districtFillLayer} />
            <Layer {...districtOutlineLayer} />
            <Layer {...buildHighlightLayer(activeDistrictId)} />
          </Source>
        ) : null}
      </Map>
    </div>
  );
}
