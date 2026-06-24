import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Country, PcodeResult } from "$lib/types";

let protocolRegistered = false;

export function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile.bind(protocol));
  protocolRegistered = true;
}

// Layer ID helpers
export const fillLayerId = (level: number) => `adm${level}-fill`;
export const lineLayerId = (level: number) => `adm${level}-line`;
export const highlightFillId = (level: number) => `adm${level}-highlight-fill`;
export const highlightLineId = (level: number) => `adm${level}-highlight-line`;
const sourceId = (level: number) => `adm${level}`;

// Stroke colours that get darker at finer admin levels
const STROKE_COLORS = ["#888", "#666", "#555", "#444", "#333"];
const FILL_OPACITY = 0;
const HIGHLIGHT_FILL = "#aad4e0";
const HIGHLIGHT_STROKE = "#1d4ed8";

export function addCountryLayers(map: MaplibreMap, country: Country) {
  for (const adm of country.adminLevels) {
    const src = sourceId(adm.level);

    if (!map.getSource(src)) {
      map.addSource(src, {
        type: "vector",
        url: `pmtiles://${adm.pmtilesUrl}`,
      });
    }

    const stroke = STROKE_COLORS[adm.level] ?? "#333";

    // Invisible fill for hit-testing
    if (!map.getLayer(fillLayerId(adm.level))) {
      map.addLayer({
        id: fillLayerId(adm.level),
        type: "fill",
        source: src,
        "source-layer": adm.id,
        paint: { "fill-color": "#000", "fill-opacity": FILL_OPACITY },
      });
    }

    // Boundary lines
    if (!map.getLayer(lineLayerId(adm.level))) {
      map.addLayer({
        id: lineLayerId(adm.level),
        type: "line",
        source: src,
        "source-layer": adm.id,
        paint: {
          "line-color": stroke,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            adm.level === 0 ? 0.8 : 0.3,
            8,
            adm.level === 0 ? 1.5 : 0.8,
            12,
            adm.level === 0 ? 2 : 1.2,
          ],
        },
      });
    }

    // Highlight layers (filtered to matched pcode, initially nothing shown)
    if (!map.getLayer(highlightFillId(adm.level))) {
      map.addLayer({
        id: highlightFillId(adm.level),
        type: "fill",
        source: src,
        "source-layer": adm.id,
        filter: ["==", `adm${adm.level}_pcode`, ""],
        paint: { "fill-color": HIGHLIGHT_FILL, "fill-opacity": 0.4 },
      });
    }

    if (!map.getLayer(highlightLineId(adm.level))) {
      map.addLayer({
        id: highlightLineId(adm.level),
        type: "line",
        source: src,
        "source-layer": adm.id,
        filter: ["==", `adm${adm.level}_pcode`, ""],
        paint: { "line-color": HIGHLIGHT_STROKE, "line-width": 2 },
      });
    }
  }
}

export function removeCountryLayers(map: MaplibreMap, country: Country) {
  for (const adm of country.adminLevels) {
    for (const id of [
      fillLayerId(adm.level),
      lineLayerId(adm.level),
      highlightFillId(adm.level),
      highlightLineId(adm.level),
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(sourceId(adm.level))) map.removeSource(sourceId(adm.level));
  }
}

export function clearHighlight(map: MaplibreMap, country: Country) {
  for (const adm of country.adminLevels) {
    if (map.getLayer(highlightFillId(adm.level))) {
      map.setFilter(highlightFillId(adm.level), ["==", `adm${adm.level}_pcode`, ""]);
      map.setFilter(highlightLineId(adm.level), ["==", `adm${adm.level}_pcode`, ""]);
    }
  }
}

export function applyHighlight(map: MaplibreMap, result: PcodeResult) {
  // Highlight each matched admin level with its pcode
  for (const { level, pcode } of result.levels) {
    const fillId = highlightFillId(level);
    const lineId = highlightLineId(level);
    if (map.getLayer(fillId)) {
      map.setFilter(fillId, ["==", `adm${level}_pcode`, pcode]);
      map.setFilter(lineId, ["==", `adm${level}_pcode`, pcode]);
    }
  }
}

export function queryPoint(
  map: MaplibreMap,
  point: { x: number; y: number },
  country: Country,
): PcodeResult | null {
  const layerIds = country.adminLevels.map((a) => fillLayerId(a.level));
  const pt: [number, number] = [point.x, point.y];
  const features = map.queryRenderedFeatures(pt, { layers: layerIds });
  if (features.length === 0) return null;

  // Find the finest visible feature (only the selected level's fill is visible)
  let finestLevel = -1;
  let finestProps: Record<string, unknown> | null = null;
  for (const f of features) {
    const props = f.properties as Record<string, unknown>;
    for (const adm of country.adminLevels) {
      if (f.layer.id === fillLayerId(adm.level) && adm.level > finestLevel) {
        finestLevel = adm.level;
        finestProps = props;
      }
    }
  }

  if (!finestProps || finestLevel < 0) return null;

  // Extract all ancestor levels from the feature properties (ADM{N} tiles carry
  // adm0..admN pcode/name columns, so we get the full hierarchy in one hit).
  const levels = [];
  for (let i = 0; i <= finestLevel; i++) {
    const pcode = String(finestProps[`adm${i}_pcode`] ?? "");
    const name = String(finestProps[`adm${i}_name`] ?? "");
    if (pcode) levels.push({ level: i, pcode, name });
  }

  if (levels.length === 0) return null;

  const lngLat = map.unproject(pt);
  return { latitude: lngLat.lat, longitude: lngLat.lng, levels };
}

export function zoomToPolygon(map: MaplibreMap, level: number) {
  const features = map.queryRenderedFeatures({ layers: [highlightFillId(level)] });
  if (features.length === 0) return;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  function processRing(ring: number[][]) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  for (const f of features) {
    const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] };
    if (g.type === "Polygon") {
      for (const ring of g.coordinates as number[][][]) processRing(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as number[][][][])
        for (const ring of poly) processRing(ring);
    }
  }

  if (!isFinite(minLng)) return;
  map.fitBounds([minLng, minLat, maxLng, maxLat], { padding: 60, duration: 800, maxZoom: 14 });
}

export function getFillLayerIds(country: Country): string[] {
  return country.adminLevels.map((a) => fillLayerId(a.level));
}

export function setVisibleLevel(map: MaplibreMap, country: Country, level: number) {
  for (const adm of country.adminLevels) {
    const isSelected = adm.level === level;
    const fillId = fillLayerId(adm.level);
    const lineId = lineLayerId(adm.level);
    const hFillId = highlightFillId(adm.level);
    const hLineId = highlightLineId(adm.level);

    if (map.getLayer(fillId))
      map.setLayoutProperty(fillId, "visibility", isSelected ? "visible" : "none");
    // ADM0 line always shown for country outline context
    if (map.getLayer(lineId))
      map.setLayoutProperty(lineId, "visibility", isSelected || adm.level === 0 ? "visible" : "none");
    if (map.getLayer(hFillId))
      map.setLayoutProperty(hFillId, "visibility", isSelected ? "visible" : "none");
    if (map.getLayer(hLineId))
      map.setLayoutProperty(hLineId, "visibility", isSelected ? "visible" : "none");
  }
}
