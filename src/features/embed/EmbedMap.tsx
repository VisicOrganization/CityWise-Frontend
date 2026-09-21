import { useCallback, useRef, useState } from "react";
import Map, { Marker, Popup, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";

import { LIGHT_BASE_MAP_STYLE } from "../../shared/map/lightBaseMapStyle";
import type { DistrictBoundaryFeature } from "../../shared/map/districtBoundaries";
import { useAssetPinImages } from "../map/assetPinImages";
import {
  ASSET_POINTS_LAYER_ID,
  CATEGORY_ORDER,
  NEIGHBORHOOD_FILL_LAYER_ID,
} from "../map/neighborhoodMapLayers";
import type { HoveredAsset, HoveredNeighborhood } from "../map/NeighborhoodOverlay";
import { PROJECT_PIN_SRC } from "../../shared/map/projectPinSources";
import { toMarkerCategory } from "../../shared/map/mapTypes";
import { NeighborhoodOverlay } from "../map/NeighborhoodOverlay";
import type { AssetCollection, AssetProperties, NeighborhoodCollection } from "../map/cd2Assets";
import type { EmbedProject } from "./embedProjects";

/**
 * The embed's MapLibre instance: the base style, `NeighborhoodOverlay`'s polygons/pins/popup,
 * and -- only on the district-wide view -- the optional project pins.
 *
 * A single `<Map>` reused across neighbourhood/district views via React's `key` prop at the
 * call site (`EmbedPage`): remounting on a target change is what makes `initialViewState.bounds`
 * refit correctly, the same one-shot-bounds idiom `initialViewState` supports natively, rather
 * than reaching for imperative `fitBounds` calls in an effect.
 */



export interface EmbedMapProps {
  assets: AssetCollection;
  neighborhoods: NeighborhoodCollection;
  districtBoundary: DistrictBoundaryFeature | null;
  districtId: number;
  bounds: [[number, number], [number, number]];
  ariaLabel: string;
  /** Only populated on the district-wide view; `null` on a neighbourhood view. */
  projects: EmbedProject[] | null;
}

export function EmbedMap({
  assets,
  neighborhoods,
  districtBoundary,
  districtId,
  bounds,
  ariaLabel,
  projects,
}: EmbedMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  /**
   * A callback ref, not `ref={mapRef}`, and the same shape `CityMap.tsx` uses.
   *
   * `useAssetPinImages` bails out when `mapRef.current` is null and its deps are
   * `[mapRef, enabled]` -- a ref object is stable, so with a constant `enabled` the effect runs
   * exactly once, on mount, before react-map-gl has attached the instance, and never re-runs.
   * `pinsReady` then stays false forever, the overlay never mounts, and the page renders a
   * basemap with no boundary, no neighbourhoods and no pins. Setting state as the instance
   * attaches is what gives the effect a second, useful run.
   */
  const setMapInstance = useCallback((instance: MapRef | null) => {
    mapRef.current = instance;
    setIsMapReady(Boolean(instance));
  }, []);

  const pinsReady = useAssetPinImages(mapRef, isMapReady);
  const [selectedAsset, setSelectedAsset] = useState<{
    longitude: number;
    latitude: number;
    properties: Partial<AssetProperties>;
  } | null>(null);
  const [selectedProject, setSelectedProject] = useState<EmbedProject | null>(null);

  /** Desktop-only by nature: onMouseMove never fires from touch input -- same as `/map`. */
  const [hoveredAsset, setHoveredAsset] = useState<HoveredAsset | null>(null);
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState<HoveredNeighborhood | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

  // Hit-testing is scoped by interactiveLayerIds, so the hover handler reads `event.features`
  // rather than calling queryRenderedFeatures -- the same reasoning CityMap records.
  const interactiveLayerIds = [ASSET_POINTS_LAYER_ID, NEIGHBORHOOD_FILL_LAYER_ID];

  function handleMouseMove(event: MapLayerMouseEvent) {
    const assetFeature = event.features?.find(
      (feature) => feature.layer?.id === ASSET_POINTS_LAYER_ID,
    );
    if (assetFeature) {
      const properties = assetFeature.properties ?? {};
      const label = typeof properties.label === "string" ? properties.label : null;
      setHoveredNeighborhood(null);
      setHoveredAsset(
        label
          ? {
              label,
              category: typeof properties.category === "string" ? properties.category : "",
              // Carried so the hover layer matches this one pin, not every pin sharing its name.
              neighborhood:
                typeof properties.neighborhood === "string" ? properties.neighborhood : "",
              longitude: event.lngLat.lng,
              latitude: event.lngLat.lat,
            }
          : null,
      );
      return;
    }

    setHoveredAsset(null);
    const neighborhoodFeature = event.features?.find(
      (feature) => feature.layer?.id === NEIGHBORHOOD_FILL_LAYER_ID,
    );
    const csaLabel = neighborhoodFeature?.properties?.CSA_Label;
    setHoveredNeighborhood(
      typeof csaLabel === "string"
        ? { label: csaLabel, longitude: event.lngLat.lng, latitude: event.lngLat.lat }
        : null,
    );
  }

  function handleMouseLeave() {
    setHoveredAsset(null);
    setHoveredNeighborhood(null);
  }

  function handleClick(event: MapLayerMouseEvent) {
    const feature = event.features?.[0];
    if (!feature) {
      setSelectedAsset(null);
      setSelectedProject(null);
      return;
    }
    if (feature.layer?.id === ASSET_POINTS_LAYER_ID) {
      const [longitude, latitude] = event.lngLat.toArray();
      setSelectedProject(null);
      setSelectedAsset({ longitude, latitude, properties: feature.properties ?? {} });
      return;
    }

    // The neighbourhood fill is interactive for hover, so a click can land on it with no pin
    // underneath. That is a click on the map, not on a resource: dismiss, don't leave a stale
    // popup anchored to whatever was selected before.
    setSelectedAsset(null);
    setSelectedProject(null);
  }

  return (
    <div className="h-full w-full" role="region" aria-label={ariaLabel}>
      <Map
        ref={setMapInstance}
        initialViewState={{
          bounds,
          fitBoundsOptions: { padding: 32, maxZoom: 15 },
        }}
        mapStyle={LIGHT_BASE_MAP_STYLE}
        interactiveLayerIds={pinsReady ? interactiveLayerIds : []}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        cursor={hoveredAsset || hoveredNeighborhood ? "pointer" : "grab"}
        style={{ width: "100%", height: "100%" }}
        // Deliberately left at its default (on), like `HomelessCountPage.tsx`: ODbL requires
        // visible attribution, and unlike `CityMap.tsx`/`DistrictMap.tsx` this page has no other
        // chrome that carries it.
      >
        {pinsReady ? (
          <NeighborhoodOverlay
            assets={assets}
            neighborhoods={neighborhoods}
            districtBoundary={districtBoundary}
            activeCategories={CATEGORY_ORDER}
            selectedNeighborhood={null}
            hoveredNeighborhood={hoveredNeighborhood}
            hoveredAsset={hoveredAsset}
            selected={selectedAsset}
            onCloseSelected={() => setSelectedAsset(null)}
            districtId={districtId}
          />
        ) : null}

        {/* Council-file pins as DOM `<Marker>`s carrying the same per-category artwork `/map`
            uses, via the shared `PROJECT_PIN_SRC` table -- a resident should not have to learn
            two pin vocabularies for the same data. Markers rather than a symbol layer for the
            same reason CityMap uses them: arbitrary React content and CSS hover, which a WebGL
            symbol layer cannot have. Being DOM, they also sit outside MapLibre's layer ordering
            entirely, so the z-order race the overlay's comment warns about cannot apply here. */}
        {(projects ?? []).map((project) => (
          <Marker
            key={project.id}
            longitude={project.longitude}
            latitude={project.latitude}
            anchor="bottom"
            subpixelPositioning
          >
            <button
              type="button"
              className={`map-project-marker ${
                hoveredProjectId === project.id || selectedProject?.id === project.id
                  ? "marker-active"
                  : ""
              }`}
              aria-label={project.title}
              onMouseEnter={() => setHoveredProjectId(project.id)}
              onMouseLeave={() =>
                setHoveredProjectId((current) => (current === project.id ? null : current))
              }
              onFocus={() => setHoveredProjectId(project.id)}
              onBlur={() =>
                setHoveredProjectId((current) => (current === project.id ? null : current))
              }
              onClick={(event) => {
                event.stopPropagation();
                setSelectedAsset(null);
                setSelectedProject(project);
              }}
            >
              <span className="map-marker-pin-anchor">
                <img
                  src={PROJECT_PIN_SRC[toMarkerCategory(project.category)]}
                  alt=""
                  width={39}
                  height={48}
                  draggable={false}
                />
              </span>
            </button>
          </Marker>
        ))}

        {selectedProject ? (
          <Popup
            longitude={selectedProject.longitude}
            latitude={selectedProject.latitude}
            closeOnClick={false}
            onClose={() => setSelectedProject(null)}
            maxWidth="16rem"
          >
            <div className="font-sans text-sm text-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                {selectedProject.category}
              </p>
              <p className="mt-0.5 font-medium">{selectedProject.title}</p>
              {selectedProject.url ? (
                <a
                  className="mt-1 inline-block text-sky-700 underline"
                  href={selectedProject.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View council file
                </a>
              ) : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}
