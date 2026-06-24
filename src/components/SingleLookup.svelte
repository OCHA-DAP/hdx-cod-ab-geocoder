<script lang="ts">
  import PcodeResultCard from "./PcodeResultCard.svelte";
  import type { Country, PcodeResult } from "$lib/types";

  interface Props {
    country: Country | null;
    result: PcodeResult | null;
    onLookup: (lat: number, lon: number) => void;
  }

  let { country, result, onLookup }: Props = $props();

  let coordStr = $state("");
  let validationError = $state<string | null>(null);

  const coordValid = $derived.by(() => {
    const parsed = parseCoord(coordStr);
    if (!parsed) return false;
    const [lat, lon] = parsed;
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  });

  function parseCoord(raw: string): [number, number] | null {
    const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lon)) return null;
    return [lat, lon];
  }

  function submit(e: Event) {
    e.preventDefault();
    validationError = null;
    const parsed = parseCoord(coordStr);
    if (!parsed) {
      validationError = "Enter coordinates as 'lat, lon' (e.g. 36.81, 10.18).";
      return;
    }
    const [lat, lon] = parsed;
    if (lat < -90 || lat > 90) {
      validationError = "Latitude must be between -90 and 90.";
      return;
    }
    if (lon < -180 || lon > 180) {
      validationError = "Longitude must be between -180 and 180.";
      return;
    }
    onLookup(lat, lon);
  }
</script>

<section>
  <h3>Point Lookup</h3>
  <form onsubmit={submit}>
    <div class="field">
      <label for="coord">Coordinates (lat, lon)</label>
      <input
        id="coord"
        type="text"
        inputmode="decimal"
        placeholder="e.g. 36.81, 10.18"
        bind:value={coordStr}
        disabled={!country}
      />
    </div>
    {#if validationError}
      <div class="error">{validationError}</div>
    {/if}
    <button type="submit" disabled={!country || !coordValid}>Lookup</button>
  </form>
  {#if !country}
    <p class="hint">Select a country above to enable point lookup.</p>
  {/if}
  <PcodeResultCard {result} />
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #374151;
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
  }

  input {
    padding: 0.5rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #111;
  }

  input:disabled {
    background: #f9fafb;
    color: #9ca3af;
  }

  input:focus {
    outline: 2px solid #1d4ed8;
    outline-offset: 1px;
  }

  button {
    padding: 0.55rem 1rem;
    background: #1d4ed8;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
  }

  button:hover:not(:disabled) {
    background: #1e40af;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    font-size: 0.8rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
  }

  .hint {
    font-size: 0.8rem;
    color: #6b7280;
    margin: 0;
  }
</style>
