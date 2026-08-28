const CARTO_LIGHT_ALL_TILES = "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";

export function cartoLightAllTilesUrl(apiKey = import.meta.env.VITE_CARTO_API_KEY): string {
  const key = String(apiKey ?? "").trim();
  return key ? `${CARTO_LIGHT_ALL_TILES}?key=${encodeURIComponent(key)}` : CARTO_LIGHT_ALL_TILES;
}
