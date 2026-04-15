import type { ExpressionSpecification, FillLayerSpecification, LineLayerSpecification, StyleSpecification } from "maplibre-gl";


const districtColors: Array<number | string> = [
  1, "#e76f51",
  2, "#f4a261",
  3, "#e9c46a",
  4, "#90be6d",
  5, "#43aa8b",
  6, "#4d908e",
  7, "#577590",
  8, "#277da1",
  9, "#9b5de5",
  10, "#f15bb5",
  11, "#ef476f",
  12, "#ff7f51",
  13, "#06d6a0",
  14, "#118ab2",
  15, "#8338ec",
];

export const districtColorById: Record<number, string> = {
  1: "#e76f51",
  2: "#f4a261",
  3: "#e9c46a",
  4: "#90be6d",
  5: "#43aa8b",
  6: "#4d908e",
  7: "#577590",
  8: "#277da1",
  9: "#9b5de5",
  10: "#f15bb5",
  11: "#ef476f",
  12: "#ff7f51",
  13: "#06d6a0",
  14: "#118ab2",
  15: "#8338ec",
};

export const districtColorExpression = [
  "match",
  ["get", "District"],
  ...districtColors,
  "#90b4ce",
] as unknown as ExpressionSpecification;

export const districtFillOpacityExpression = [
  "interpolate",
  ["linear"],
  ["zoom"],
  7,
  0.42,
  9.5,
  0.28,
  12,
  0.16,
  14.5,
  0.08,
] as unknown as ExpressionSpecification;


export const districtFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "district-fill",
  type: "fill",
  paint: {
    "fill-color": districtColorExpression,
    "fill-opacity": districtFillOpacityExpression,
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
    "fill-opacity": 0.5,
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
