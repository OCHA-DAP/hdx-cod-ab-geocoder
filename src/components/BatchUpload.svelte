<script lang="ts">
  import { initDuckDB, duckdbState } from "$lib/db/duckdb.svelte";
  import { batchGeocode } from "$lib/db/geocode";
  import type { Country } from "$lib/types";

  interface Props {
    country: Country | null;
    selectedLevel: number;
  }

  let { country, selectedLevel }: Props = $props();

  let file = $state<File | null>(null);
  let dragging = $state(false);
  let status = $state<"idle" | "loading" | "done" | "error">("idle");
  let progress = $state(0);
  let errorMsg = $state<string | null>(null);
  let downloadUrl = $state<string | null>(null);
  let downloadName = $state("geocoded.xlsx");
  let geocodedLevel = $state<number | null>(null);

  $effect(() => {
    const level = selectedLevel;
    if (geocodedLevel !== null && geocodedLevel !== level && file && country && status !== "loading") {
      run();
    }
  });

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.match(/\.(csv|xlsx?)$/i)) {
      errorMsg = "Please upload a CSV or Excel file.";
      return;
    }
    file = f;
    errorMsg = null;
    status = "idle";
    downloadUrl = null;
    run();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  async function run() {
    if (!file || !country) return;
    status = "loading";
    progress = 0;
    errorMsg = null;
    downloadUrl = null;

    try {
      if (!duckdbState.ready) {
        progress = 5;
        await initDuckDB();
      }
      progress = 10;

      const blob = await batchGeocode(file, country, selectedLevel, (p) => {
        progress = 10 + Math.round(p * 85);
      });

      progress = 100;
      downloadUrl = URL.createObjectURL(blob);
      downloadName = file.name.replace(/\.[^.]+$/, "") + "_geocoded.xlsx";
      geocodedLevel = selectedLevel;
      status = "done";
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      status = "error";
    }
  }
</script>

<section>
  <h3>Batch Geocode</h3>

  {#if !country}
    <p class="hint">Select a country above to enable batch geocoding.</p>
  {:else}
    <!-- Drop zone -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="dropzone"
      class:dragging
      ondragover={(e) => { e.preventDefault(); dragging = true; }}
      ondragleave={() => { dragging = false; }}
      ondrop={onDrop}
    >
      <input
        type="file"
        accept=".csv,.xls,.xlsx"
        id="batch-file"
        class="file-input"
        onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
      />
      {#if file}
        <span class="filename">{file.name}</span>
        <label for="batch-file" class="change-link">Change file</label>
      {:else}
        <label for="batch-file" class="drop-label">
          Drop a CSV or Excel file here, or <span class="link">click to browse</span>
        </label>
      {/if}
    </div>

    <p class="hint">
      File must have <code>lat</code> and <code>lon</code> columns (or <code>latitude</code> /
      <code>longitude</code>).
    </p>

    {#if errorMsg}
      <div class="error">{errorMsg}</div>
    {/if}

    {#if status === "loading"}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <p class="hint">
        {#if progress < 10}
          Initialising DuckDB…
        {:else if progress < 95}
          Geocoding rows… ({progress}%)
        {:else}
          Generating output…
        {/if}
      </p>
    {/if}

    {#if downloadUrl}
      <a href={downloadUrl} download={downloadName} class="download-btn">
        Download XLSX
      </a>
    {/if}
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

  .dropzone {
    border: 2px dashed #9ca3af;
    border-radius: 8px;
    padding: 1.25rem 1rem;
    text-align: center;
    background: #f9fafb;
    transition:
      border-color 0.15s,
      background 0.15s;
    position: relative;
  }

  .dropzone.dragging {
    border-color: #1d4ed8;
    background: #eff6ff;
  }

  .file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .drop-label {
    font-size: 0.875rem;
    color: #6b7280;
    cursor: pointer;
  }

  .link {
    color: #1d4ed8;
    text-decoration: underline;
  }

  .filename {
    font-size: 0.875rem;
    color: #111;
    font-family: monospace;
    display: block;
    margin-bottom: 0.25rem;
  }

  .change-link {
    font-size: 0.8rem;
    color: #1d4ed8;
    cursor: pointer;
    text-decoration: underline;
  }

  .hint {
    font-size: 0.8rem;
    color: #6b7280;
    margin: 0;
  }

  code {
    background: #f3f4f6;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .error {
    font-size: 0.8rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }

  .progress-bar {
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #1d4ed8;
    border-radius: 2px;
    transition: width 0.2s ease;
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
