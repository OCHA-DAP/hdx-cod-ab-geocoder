<script lang="ts">
  import { initDuckDB, duckdbState } from "$lib/db/duckdb.svelte";
  import { generateXlsForm } from "$lib/db/xlsform";
  import type { Country } from "$lib/types";

  interface Props {
    country: Country | null;
    selectedLevel: number;
  }

  let { country, selectedLevel }: Props = $props();

  let status = $state<"idle" | "loading" | "done" | "error">("idle");
  let errorMsg = $state<string | null>(null);
  let downloadUrl = $state<string | null>(null);
  let downloadName = $state("xlsform.xlsx");
  let generatedLevel = $state<number | null>(null);

  $effect(() => {
    const level = selectedLevel;
    if (generatedLevel !== null && generatedLevel !== level && country && status !== "loading") {
      generate();
    }
  });

  async function generate() {
    if (!country) return;
    status = "loading";
    errorMsg = null;
    downloadUrl = null;

    try {
      if (!duckdbState.ready) await initDuckDB();
      const blob = await generateXlsForm(country, selectedLevel);
      downloadUrl = URL.createObjectURL(blob);
      downloadName = `${country.iso3}_xlsform.xlsx`;
      generatedLevel = selectedLevel;
      status = "done";
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      status = "error";
    }
  }
</script>

<section>
  <h3>XLSForm</h3>

  {#if !country}
    <p class="hint">Select a country above to generate an XLSForm.</p>
  {:else}
    <p class="hint">
      Download a KoboCollect XLSForm with cascading admin-boundary selects for
      <strong>{country.name}</strong> up to ADM{selectedLevel}.
    </p>

    {#if errorMsg}
      <div class="error">{errorMsg}</div>
    {/if}

    <div class="actions">
      {#if status !== "done"}
        <button onclick={generate} disabled={status === "loading"}>
          {status === "loading" ? "Generating…" : "Generate XLSForm"}
        </button>
      {/if}

      {#if downloadUrl}
        <a href={downloadUrl} download={downloadName} class="download-btn">
          Download XLSForm
        </a>
      {/if}
    </div>
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

  .error {
    font-size: 0.8rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  button {
    padding: 0.5rem 1rem;
    background: #1d4ed8;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #1e40af;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .download-btn {
    padding: 0.5rem 1rem;
    background: #16a34a;
    color: #fff;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }

  .download-btn:hover {
    background: #15803d;
  }
</style>
