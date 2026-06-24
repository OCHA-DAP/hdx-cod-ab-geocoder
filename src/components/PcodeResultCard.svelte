<script lang="ts">
  import type { PcodeResult } from "$lib/types";

  interface Props {
    result: PcodeResult | null;
  }

  let { result }: Props = $props();
</script>

{#if result}
  <div class="card">
    <div class="coords">
      {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
    </div>
    <div class="levels">
      {#each result.levels as { level, pcode, name } (level)}
        <div class="level">
          <span class="label">ADM{level}</span>
          <span class="name">{name}</span>
          <span class="pcode">{pcode}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .card {
    border: 1px solid #e5e7eb;
    border-left: 3px solid #aad4e0;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .coords {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: monospace;
  }

  .levels {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .level {
    display: grid;
    grid-template-columns: 3rem 1fr auto;
    gap: 0.4rem;
    align-items: baseline;
    font-size: 0.875rem;
  }

  .label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
  }

  .name {
    color: #111;
    font-weight: 500;
  }

  .pcode {
    color: #4b5563;
    font-family: monospace;
    font-size: 0.8rem;
  }
</style>
