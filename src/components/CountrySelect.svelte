<script lang="ts">
  import { loadCatalog } from "$lib/catalog";
  import type { Country } from "$lib/types";

  interface Props {
    value: Country | null;
    onchange: (country: Country | null) => void;
  }

  let { value, onchange }: Props = $props();

  let countries = $state<Country[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loadCatalog()
      .then((c) => {
        countries = c;
        loading = false;
      })
      .catch((e) => {
        error = e instanceof Error ? e.message : String(e);
        loading = false;
      });
  });

  function handleChange(e: Event) {
    const iso3 = (e.target as HTMLSelectElement).value;
    onchange(countries.find((c) => c.iso3 === iso3) ?? null);
  }
</script>

<div class="field">
  <label for="country-select">Country</label>
  {#if loading}
    <div class="hint">Loading countries…</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <select id="country-select" onchange={handleChange} value={value?.iso3 ?? ""}>
      <option value="">Select a country…</option>
      {#each countries as c (c.iso3)}
        <option value={c.iso3}>{c.name}</option>
      {/each}
    </select>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #374151;
  }

  select {
    padding: 0.5rem 0.7rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #111;
    background: #fff;
    cursor: pointer;
  }

  select:focus {
    outline: 2px solid #1d4ed8;
    outline-offset: 1px;
  }

  .hint {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .error {
    font-size: 0.875rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }
</style>
