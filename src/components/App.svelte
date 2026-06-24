<script lang="ts">
  import Map from "./Map.svelte";
  import CountrySelect from "./CountrySelect.svelte";
  import SingleLookup from "./SingleLookup.svelte";
  import BatchUpload from "./BatchUpload.svelte";
  import XlsFormDownload from "./XlsFormDownload.svelte";
  import BoundaryLinks from "./BoundaryLinks.svelte";
  import type { Country, PcodeResult } from "$lib/types";

  let country = $state<Country | null>(null);
  let selectedLevel = $state<number>(0);
  let result = $state<PcodeResult | null>(null);
  let mapRef: Map | undefined;

  function handleCountryChange(c: Country | null) {
    country = c;
    selectedLevel = c?.maxAdmLevel ?? 0;
    result = null;
  }

  function handleLevelChange(level: number) {
    selectedLevel = level;
    result = null;
    mapRef?.clearAllHighlights();
  }

  function handleResult(r: PcodeResult) {
    result = r;
  }

  function handleLookup(lat: number, lon: number) {
    mapRef?.flyAndQuery(lat, lon);
  }
</script>

<div class="layout">
  <aside class="sidebar">
    <header class="sidebar-header">
      <h1>COD-AB Geocoder</h1>
      <p class="subtitle">OCHA Common Operational Datasets</p>
    </header>

    <div class="sidebar-body">
      <CountrySelect value={country} onchange={handleCountryChange} />

      {#if country}
        <div class="level-select">
          {#each country.adminLevels.filter((a) => a.level > 0) as adm (adm.level)}
            <button
              class="level-btn"
              class:active={selectedLevel === adm.level}
              onclick={() => handleLevelChange(adm.level)}
            >
              ADM{adm.level}
            </button>
          {/each}
        </div>
      {/if}

      <hr />

      <SingleLookup {country} {result} onLookup={handleLookup} />

      <hr />

      <BatchUpload {country} {selectedLevel} />

      <hr />

      <XlsFormDownload {country} {selectedLevel} />

      <hr />

      <BoundaryLinks {country} />
    </div>

    <footer class="sidebar-footer">
      <a href="https://cod.unocha.org" target="_blank" rel="noopener">OCHA COD Portal</a>
      ·
      <a href="https://source.coop/hdx/cod-ab" target="_blank" rel="noopener">Data on Source Cooperative</a>
    </footer>
  </aside>

  <div class="map-wrap">
    <Map bind:this={mapRef} {country} {selectedLevel} onResult={handleResult} />
  </div>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    height: 100dvh;
    overflow: hidden;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 1.25rem 1.25rem 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #111;
    margin: 0 0 0.15rem;
  }

  .subtitle {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 0;
  }

  .level-select {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .level-btn {
    padding: 0.25rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #f9fafb;
    color: #374151;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    font-family: monospace;
    letter-spacing: 0.03em;
  }

  .level-btn:hover {
    border-color: #9ca3af;
    background: #f3f4f6;
  }

  .level-btn.active {
    background: #1d4ed8;
    border-color: #1d4ed8;
    color: #fff;
  }

  .sidebar-footer {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    flex-shrink: 0;
  }

  .sidebar-footer a {
    color: #4b5563;
    text-decoration: none;
  }

  .sidebar-footer a:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }

  .map-wrap {
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
      max-height: 50dvh;
    }
  }
</style>
