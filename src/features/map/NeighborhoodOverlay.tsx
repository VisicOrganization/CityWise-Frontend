import { Layer, Popup, Source } from "react-map-gl/maplibre";

import type { FeatureCollection } from "geojson";

import { districtBoundaryLineLayer } from "../../shared/map/districtLayers";
import type { DistrictBoundaryFeature } from "../../shared/map/districtBoundaries";
import { NEIGHBORHOOD_DISTRICT_ID, type AssetProperties } from "./cd2Assets";
import { NeighborhoodAssetPopup } from "./NeighborhoodAssetPopup";
import {
  assetPointBackingLayer,
  assetPointLayer,
  buildAssetHoverLayer,
  buildSelectedAssetBackingLayer,
  buildSelectedAssetGlowLayer,
  buildSelectedAssetLayer,
  buildCategoryFilter,
  buildNeighborhoodFilter,
  CATEGORY_LABELS,
  neighborhoodFillLayer,
  neighborhoodHoverFillLayer,
  neighborhoodLabelLayer,
  neighborhoodOutlineCasingLayer,
  neighborhoodOutlineLayer,
  neighborhoodSelectedFillLayer,
} from "./neighborhoodMapLayers";
import type { AssetCollection, NeighborhoodCollection } from "./cd2Assets";

/**
 * The neighbourhood overlay's map children: outlines, the district edge, and the resource pins.
 *
 * Returns a fragment of `<Source>`/`<Layer>`/`<Popup>` rather than its own `<Map>`, because it
 * draws into CityMap's existing MapLibre instance -- a second instance would mean a second
 * WebGL context over the same viewport.
 *
 * Layer order is the reason this is one component rather than several call sites, bottom to top:
 * base fill, selection fill, hover fill, white outline casing, dark outline, neighbourhood
 * labels, the true district edge, then the pins. Fills stack under the edges so no state change
 * ever hides a boundary, and everything stacks under the pins so no line crosses one.
 *
 * EVERY LAYER HERE MOUNTS UNCONDITIONALLY, and turns itself off with a filter that matches
 * nothing. Do not wrap one in `{state ? <Layer/> : null}` again. react-map-gl calls
 * `map.addLayer(options, beforeId)` on mount, and with no `beforeId` MapLibre appends to the TOP
 * of the style -- so a layer that mounts late sits above everything already there, regardless of
 * where it appears in this JSX. That is how the selected-neighbourhood fill ended up painting
 * its 22%-opacity orange over the pins inside it and shifting their colour: it only mounted on
 * the click that selected the neighbourhood, long after the pin layers.
 */
export interface HoveredAsset {
  longitude: number;
  latitude: number;
  label: string;
  category: string;
}

export interface HoveredNeighborhood {
  longitude: number;
  latitude: number;
  label: string;
}

export interface NeighborhoodOverlayProps {
  assets: AssetCollection;
  neighborhoods: NeighborhoodCollection;
  districtBoundary: DistrictBoundaryFeature | null;
  activeCategories: readonly string[];
  selectedNeighborhood: string | null;
  hoveredNeighborhood: HoveredNeighborhood | null;
  hoveredAsset: HoveredAsset | null;
  selected: { longitude: number; latitude: number; properties: Partial<AssetProperties> } | null;
  onCloseSelected: () => void;
}

/** Mounted in place of a missing boundary so the layer's position in the style never moves. */
const EMPTY_BOUNDARY: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** "Los Angeles - Sun Valley" -> "Sun Valley", matching the on-map label layer. */
function shortNeighborhoodName(label: string): string {
  return label.startsWith("Los Angeles - ") ? label.slice("Los Angeles - ".length) : label;
}

export function NeighborhoodOverlay({
  assets,
  neighborhoods,
  districtBoundary,
  activeCategories,
  selectedNeighborhood,
  hoveredNeighborhood,
  hoveredAsset,
  selected,
  onCloseSelected,
}: NeighborhoodOverlayProps) {
  // Hover suppressed on the already-selected neighbourhood: stacking both fills would read as a
  // third, darker state that means nothing. Expressed as the filter's input rather than by not
  // rendering the layer, so the layer keeps its place in the style.
  const hoverFillLabel =
    hoveredNeighborhood && hoveredNeighborhood.label !== selectedNeighborhood
      ? hoveredNeighborhood.label
      : null;

  /**
   * The selection stack draws only while the selected pin's own category is switched on.
   *
   * Without this the three selection layers carry no category filter, while the two base layers
   * do -- so unchecking the selected pin's category (or "Deselect all") removed its icon and
   * left the 1.5x icon, its white backing and its glow floating with nothing underneath. Worse,
   * those layers are not in `interactiveLayerIds`, so the ghost could not be clicked away.
   *
   * Hiding rather than deselecting is the deliberate half: the legend filters what is drawn, it
   * does not change what you picked, so re-checking the category brings the selection back.
   */
  const visibleSelected =
    selected && activeCategories.includes(selected.properties.category ?? "") ? selected : null;

  return (
    <>
      <Source id="cd2-neighborhoods" type="geojson" data={neighborhoods}>
        <Layer {...neighborhoodFillLayer} />
        <Layer
          {...neighborhoodSelectedFillLayer}
          filter={buildNeighborhoodFilter(selectedNeighborhood)}
        />
        <Layer {...neighborhoodHoverFillLayer} filter={buildNeighborhoodFilter(hoverFillLabel)} />
        <Layer {...neighborhoodOutlineCasingLayer} />
        <Layer {...neighborhoodOutlineLayer} />
        <Layer {...neighborhoodLabelLayer} />
      </Source>

      {/* The real district edge over the CSA fills. CSA boundaries are not council district
          boundaries, and drawing both is what makes the difference visible instead of implied.
          Empty data rather than an unmounted Source while the boundary loads: this arrives
          asynchronously, so mounting it on arrival would append its line above the pins. */}
      <Source
        id="cd2-district-boundary"
        type="geojson"
        data={districtBoundary ?? EMPTY_BOUNDARY}
      >
        <Layer {...districtBoundaryLineLayer} />
      </Source>

      {/* Bottom to top: the white disc that gives every pin an edge, the pins, then the
          selection stack, then hover. The selected pin sits above the base layer so a neighbour
          can never cover it, and below hover so pointing at it still reads as a hover. */}
      <Source id="cd2-assets" type="geojson" data={assets}>
        <Layer {...assetPointBackingLayer} filter={buildCategoryFilter(activeCategories)} />
        <Layer {...assetPointLayer} filter={buildCategoryFilter(activeCategories)} />
        <Layer {...buildSelectedAssetGlowLayer(visibleSelected?.properties ?? null)} />
        <Layer {...buildSelectedAssetBackingLayer(visibleSelected?.properties ?? null)} />
        <Layer {...buildSelectedAssetLayer(visibleSelected?.properties ?? null)} />
        <Layer {...buildAssetHoverLayer(hoveredAsset?.label ?? null)} />
      </Source>

      {/* Follows the cursor. Only one of the two tooltips is ever shown: over a pin the pin's
          identity is what the user is asking about, not the neighbourhood under it. */}
      {hoveredAsset ? (
        <Popup
          longitude={hoveredAsset.longitude}
          latitude={hoveredAsset.latitude}
          closeButton={false}
          closeOnClick={false}
          offset={16}
          className="map-neighborhood-hover-popup"
        >
          <div className="map-neighborhood-hover-card">
            <span className="map-neighborhood-hover-category">
              {CATEGORY_LABELS[hoveredAsset.category] ?? hoveredAsset.category}
            </span>
            <span className="map-neighborhood-hover-title">{hoveredAsset.label}</span>
            <span className="map-neighborhood-hover-cta">Click for contact details.</span>
          </div>
        </Popup>
      ) : hoveredNeighborhood ? (
        <Popup
          longitude={hoveredNeighborhood.longitude}
          latitude={hoveredNeighborhood.latitude}
          closeButton={false}
          closeOnClick={false}
          offset={12}
          className="map-neighborhood-hover-popup"
        >
          <div className="map-neighborhood-hover-label">
            {shortNeighborhoodName(hoveredNeighborhood.label)}
          </div>
        </Popup>
      ) : null}

      {/* Gated on `visibleSelected` too: a card for a pin the legend has hidden must not leave
          its contact popup anchored over empty basemap. */}
      {visibleSelected ? (
        // maxWidth must be >= .neighborhood-asset-popup's border-box width (17rem in app.css)
        // plus the 2px border MapLibre puts on .maplibregl-popup-content. Change one, change
        // the other.
        <Popup
          longitude={visibleSelected.longitude}
          latitude={visibleSelected.latitude}
          closeOnClick={false}
          onClose={onCloseSelected}
          maxWidth="calc(17rem + 2px)"
          className="neighborhood-asset-popup-shell"
        >
          <NeighborhoodAssetPopup
            properties={visibleSelected.properties}
            districtId={NEIGHBORHOOD_DISTRICT_ID}
          />
        </Popup>
      ) : null}
    </>
  );
}
