<script lang="ts">
  import type { Country } from "$lib/types";

  interface Props {
    country: Country | null;
  }

  let { country }: Props = $props();

  let copied = $state<number | null>(null);

  function boundaryUrl(iso2: string, level: number): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${base}/boundaries/${iso2}/${level}.csv`;
  }

  async function copy(level: number) {
    if (!country) return;
    await navigator.clipboard.writeText(boundaryUrl(country.iso2, level));
    copied = level;
    setTimeout(() => {
      copied = null;
    }, 1500);
  }
</script>

<section>
  <h3>Choice List URLs</h3>

  {#if !country}
    <p class="hint">Select a country to get direct CSV links for use in KoboCollect choice fields.</p>
  {:else if country.maxAdmLevel === 0}
    <p class="hint">No admin boundary data available for {country.name}.</p>
  {:else}
    <p class="hint">
      Paste these URLs directly into a KoboCollect form as external choice lists for
      <strong>{country.name}</strong>.
    </p>
    <ul>
      {#each { length: country.maxAdmLevel } as _, i}
        {@const level = i + 1}
        {@const url = boundaryUrl(country.iso2, level)}
        <li>
          <span class="level">ADM{level}</span>
          <code class="url" title={url}>boundaries/{country.iso2}/{level}.csv</code>
          <button
            class="copy-btn"
            class:copied={copied === level}
            onclick={() => copy(level)}
            title="Copy full URL"
          >
            {copied === level ? "Copied!" : "Copy"}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #374151;
    margin: 0;
  }

  .hint {
    font-size: 0.8rem;
    color: #6b7280;
    margin: 0;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
  }

  .level {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    flex-shrink: 0;
    width: 2.8rem;
  }

  .url {
    font-size: 0.7rem;
    color: #6b7280;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .copy-btn {
    flex-shrink: 0;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 500;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    color: #374151;
    transition: background 0.1s;
  }

  .copy-btn:hover {
    background: #f3f4f6;
  }

  .copy-btn.copied {
    background: #dcfce7;
    border-color: #86efac;
    color: #15803d;
  }
</style>
