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
const BASE_URL = "https://data.source.coop/hdx/cod-ab";
const OUT_FILE = join(ROOT, "public", "catalog.json");
const CONCURRENCY = 8;
const MAX_ADM_LEVELS = 5;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function buildCountry(iso3Lower) {
  let cat;
  try {
    cat = await fetchJson(`${BASE_URL}/${iso3Lower}/latest/catalog.json`);
  } catch {
    return null;
  }

  const name = cat["cod_ab:country_name"];
  const iso2 = cat["cod_ab:country_iso2"];
  const iso3 = cat["cod_ab:country_iso3"];
  const maxAdmLevel = cat["cod_ab:admin_level_max"];

  if (!name || !iso2 || !iso3 || maxAdmLevel === undefined) return null;

  let bbox = [-180, -90, 180, 90];
  const adminLevels = [];

  for (let level = 0; level < MAX_ADM_LEVELS; level++) {
    const collUrl = `${BASE_URL}/${iso3Lower}/latest/adm${level}/collection.json`;
    let col;
    try {
      col = await fetchJson(collUrl);
    } catch {
      break;
    }

    const colBbox = col.extent?.spatial?.bbox?.[0];
    if (level === 0 && colBbox) bbox = colBbox;

    const columns = (col["table:columns"] ?? [])
      .map((c) => c.name)
      .filter((c) => c !== "geometry");

    adminLevels.push({
      level,
      id: "original",
      pmtilesUrl: `${BASE_URL}/${iso3Lower}/latest/adm${level}/original.pmtiles`,
      parquetUrl: `${BASE_URL}/${iso3Lower}/latest/adm${level}/original.parquet`,
      bbox: colBbox ?? bbox,
      columns,
    });
  }

  if (adminLevels.length === 0) return null;

  return { iso3, iso2, name, maxAdmLevel, bbox, adminLevels };
}

const root = await fetchJson(`${BASE_URL}/catalog.json`);
const iso3Codes = (root.links ?? [])
  .filter((l) => l.rel === "child")
  .map((l) => l.href.replace(/^\.\//, "").replace(/\/catalog\.json$/, ""))
  .filter((id) => /^[a-z]{3}$/.test(id));

process.stderr.write(`Processing ${iso3Codes.length} countries...\n`);

const results = [];
const errors = [];
let idx = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (idx < iso3Codes.length) {
      const iso3Lower = iso3Codes[idx++];
      try {
        const entry = await buildCountry(iso3Lower);
        if (entry) results.push(entry);
        else process.stderr.write(`  SKIP ${iso3Lower}: missing required fields\n`);
      } catch (err) {
        errors.push(`${iso3Lower}: ${err.message}`);
        process.stderr.write(`  ERROR ${iso3Lower}: ${err.message}\n`);
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
