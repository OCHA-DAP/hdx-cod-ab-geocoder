<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import maplibregl, { type Map as MaplibreMap, type MapMouseEvent } from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import { loadStyle } from "$lib/utils/mapStyle";
  import { createSpin } from "$lib/utils/spin";
  import {
    registerPmtilesProtocol,
    addCountryLayers,
    removeCountryLayers,
    applyHighlight,
    clearHighlight,
    queryPoint,
    getFillLayerIds,
    setVisibleLevel,
    zoomToPolygon,
  } from "$lib/map/pmtiles";
  import type { Country, PcodeResult } from "$lib/types";

  interface Props {
    country: Country | null;
    selectedLevel: number;
    onResult: (result: PcodeResult) => void;
  }

  let { country = $bindable(null), selectedLevel, onResult }: Props = $props();

  let container: HTMLDivElement;
  let map: MaplibreMap | undefined;
  let mapReady = $state(false);
  let prevCountry: Country | null = null;
  let marker: maplibregl.Marker | undefined;
  const spin = createSpin(() => map);

  onMount(async () => {
    registerPmtilesProtocol();
    const style = await loadStyle();

    const size = Math.min(container.clientWidth, container.clientHeight);
    map = new maplibregl.Map({
      container,
      style,
      center: [20, 10],
      zoom: Math.log2((size * Math.PI) / 512),
      minZoom: 0,
    });

    map.on("load", () => { mapReady = true; spin.start(); });
    map.on("mousedown", () => spin.stop());
    map.on("touchstart", () => spin.stop());
    map.on("wheel", () => spin.stop());

    map.on("click", (e: MapMouseEvent) => {
      if (!map || !country) return;
      const result = queryPoint(map, e.point, country);
      if (result) {
        clearHighlight(map, country);
        const selected = result.levels.find((l) => l.level === selectedLevel);
        if (selected) applyHighlight(map, { ...result, levels: [selected] });
        placeMarker(e.lngLat.lat, e.lngLat.lng);
        onResult(result);
      }
    });

    map.on("mousemove", (e: MapMouseEvent) => {
      if (!map || !country) return;
      const ids = getFillLayerIds(country);
      const features = map.queryRenderedFeatures(e.point, { layers: ids });
      map.getCanvas().style.cursor = features.length > 0 ? "crosshair" : "";
    });
  });

  onDestroy(() => {
    spin.stop();
    marker?.remove();
    map?.remove();
  });

  // React to country and selectedLevel changes.
  // Both must be read before any early return so Svelte tracks both as dependencies.
  $effect(() => {
    const c = country;
    const lvl = selectedLevel;
    if (!mapReady || !map) return;

    if (prevCountry !== c) {
      if (prevCountry) removeCountryLayers(map, prevCountry);
      marker?.remove();
      marker = undefined;
      prevCountry = c;
      if (!c) return;
      spin.stop();
      addCountryLayers(map, c);
      map.fitBounds(c.bbox as [number, number, number, number], {
        padding: 60,
        duration: 1200,
      });
    }

    if (!c) return;
    setVisibleLevel(map, c, lvl);
  });

  export function flyAndQuery(lat: number, lon: number) {
    if (!map || !country) return;
    spin.stop();
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7), duration: 800 });
    map.once("idle", () => {
      if (!map || !country) return;
      const point = map.project([lon, lat]);
      const result = queryPoint(map, point, country);
      if (result) {
        clearHighlight(map, country);
        const selected = result.levels.find((l) => l.level === selectedLevel);
        if (selected) applyHighlight(map, { ...result, levels: [selected] });
        placeMarker(lat, lon);
        onResult(result);
        if (selected) zoomToPolygon(map, selected.level);
      }
    });
  }

  function placeMarker(lat: number, lon: number) {
    if (!map) return;
    if (marker) {
      marker.setLngLat([lon, lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText =
        "width:12px;height:12px;border-radius:50%;background:#1d4ed8;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);";
      marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
    }
  }

  export function clearAllHighlights() {
    if (!map || !country) return;
    clearHighlight(map, country);
  }
</script>

<div bind:this={container} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
  }
</style>
