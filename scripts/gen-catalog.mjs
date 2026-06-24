#!/usr/bin/env node
// @ts-nocheck
/**
 * Fetches the STAC catalog from source.coop and generates public/catalog.json.
 *
 * Usage: node scripts/gen-catalog.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE_URL = "https://data.source.coop/hdx/cod-ab/original";
const OUT_FILE = join(ROOT, "public", "catalog.json");
const CONCURRENCY = 8;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function buildCountry(catalogId) {
  let cat;
  try {
    cat = await fetchJson(`${BASE_URL}/${catalogId}/catalog.json`);
  } catch {
    return null;
  }

  const name = cat["cod_ab:country_name"];
  const iso2 = cat["cod_ab:country_iso2"];
  const iso3 = cat["cod_ab:country_iso3"];
  const maxAdmLevel = cat["cod_ab:admin_level_max"];

  if (!name || !iso2 || !iso3 || maxAdmLevel === undefined) return null;

  const isoLower = iso3.toLowerCase();
  let bbox = [-180, -90, 180, 90];
  const adminLevels = [];

  for (let level = 0; level <= maxAdmLevel; level++) {
    const collId = `${isoLower}_admin${level}`;
    let col;
    try {
      col = await fetchJson(`${BASE_URL}/${catalogId}/${collId}/collection.json`);
    } catch {
      continue;
    }

    const colBbox = col.extent?.spatial?.bbox?.[0];
    if (level === 0 && colBbox) bbox = colBbox;
    const columns = (col["table:columns"] ?? []).map((c) => c.name);

    adminLevels.push({
      level,
      id: collId,
      pmtilesUrl: `${BASE_URL}/${catalogId}/${collId}/${collId}.pmtiles`,
      parquetUrl: `${BASE_URL}/${catalogId}/${collId}/${collId}.parquet`,
      bbox: colBbox ?? bbox,
      columns,
    });
  }

  if (adminLevels.length === 0) return null;

  return { iso3, iso2, name, maxAdmLevel, bbox, adminLevels, catalogId };
}

const root = await fetchJson(`${BASE_URL}/catalog.json`);
const catalogIds = (root.links ?? [])
  .filter((l) => l.rel === "child")
  .map((l) => l.href.replace(/\/catalog\.json$/, "").split("/").at(-1))
  .filter((id) => /^cod_ab_[a-z]+$/.test(id));

process.stderr.write(`Processing ${catalogIds.length} countries...\n`);

const results = [];
const errors = [];
let idx = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (idx < catalogIds.length) {
      const catalogId = catalogIds[idx++];
      try {
        const entry = await buildCountry(catalogId);
        if (entry) results.push(entry);
        else process.stderr.write(`  SKIP ${catalogId}: missing required fields\n`);
      } catch (err) {
        errors.push(`${catalogId}: ${err.message}`);
        process.stderr.write(`  ERROR ${catalogId}: ${err.message}\n`);
      }
    }
  }),
);

results.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(join(ROOT, "public"), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(results));
process.stderr.write(`Written ${results.length} countries to ${OUT_FILE}\n`);
if (errors.length) {
  process.stderr.write(`\n${errors.length} errors:\n${errors.join("\n")}\n`);
  process.exit(1);
}
