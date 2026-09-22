import type { CircleLayerSpecification } from "maplibre-gl";

/** Always mounted with the resource source so selection never changes layer order. */
export function neighborhoodChatHighlightLayer(keys: readonly string[]): CircleLayerSpecification {
  return {
    id: "cd2-neighborhood-chat-highlights",
    source: "cd2-assets",
    type: "circle",
    filter: ["in", ["concat", ["get", "category"], "|", ["get", "neighborhood"], "|", ["get", "label"]], ["literal", [...keys]]],
    paint: {
      "circle-radius": 24,
      "circle-color": "#6aca8c",
      "circle-opacity": 0.25,
      "circle-stroke-color": "#17623c",
      "circle-stroke-width": 2,
    },
  };
}
