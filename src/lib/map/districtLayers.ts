import type { FillLayerSpecification, LineLayerSpecification, StyleSpecification } from "maplibre-gl";


export const districtFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "district-fill",
  type: "fill",
  paint: {
    "fill-color": "#90b4ce",
    "fill-opacity": 0.12,
  },
};

export const districtOutlineLayer: Omit<LineLayerSpecification, "source"> = {
  id: "district-outline",
  type: "line",
  paint: {
    "line-color": "#0f172a",
    "line-width": 1.5,
    "line-opacity": 0.45,
  },
};

export const districtHighlightLayer: Omit<FillLayerSpecification, "source"> = {
  id: "district-highlight",
  type: "fill",
  filter: ["==", ["get", "District"], -1],
  paint: {
    "fill-color": "#f97316",
    "fill-opacity": 0.38,
  },
};

export const citywiseBaseStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f5f0e8",
      },
    },
  ],
};
