#!/usr/bin/env node
// @ts-nocheck
/**
 * Generates public/boundaries/{ISO2}/{level}.csv for each country and admin level
 * in the catalog. Mirrors the Kobo geocoder endpoint format (name,label).
 *
 * Usage: node scripts/gen-boundaries.mjs
 */

import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CATALOG = JSON.parse(readFileSync(join(ROOT, "public", "catalog.json"), "utf8"));
const OUT_DIR = join(ROOT, "public", "boundaries");

function csvEscape(val) {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

async function makeConn(inst) {
  const conn = await inst.connect();
  await conn.run("INSTALL httpfs; LOAD httpfs;");
  return conn;
}

async function generateLevel(conn, country, adm) {
  const level = adm.level;
  const pcodeCol = `adm${level}_pcode`;
  const nameCol = `adm${level}_name`;

  if (!adm.columns.includes(pcodeCol) || !adm.columns.includes(nameCol)) return;

  const result = await conn.runAndReadAll(`
    SELECT DISTINCT ${pcodeCol} AS name, ${nameCol} AS label
    FROM read_parquet('${adm.parquetUrl}')
    WHERE ${pcodeCol} IS NOT NULL AND ${pcodeCol} != ''
    ORDER BY ${nameCol}
  `);

  const colNames = result.columnNames();
  const rows = result.getRowObjectsJS(colNames);
  const lines = ["name,label", ...rows.map((r) => `${csvEscape(r.name)},${csvEscape(r.label)}`)];

  const outDir = join(OUT_DIR, country.iso2);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${level}.csv`), lines.join("\n") + "\n");
  process.stderr.write(`  ${country.iso2}/${level}: ${rows.length}\n`);
}

const inst = await DuckDBInstance.create(":memory:");

const tasks = CATALOG.flatMap((country) =>
  country.adminLevels.filter((a) => a.level > 0).map((adm) => ({ country, adm })),
);

process.stderr.write(`Generating ${tasks.length} boundary CSVs...\n`);

const CONCURRENCY = 8;
const conns = await Promise.all(Array.from({ length: CONCURRENCY }, () => makeConn(inst)));

let idx = 0;
const errors = [];
await Promise.all(
  conns.map(async (conn) => {
    while (idx < tasks.length) {
      const { country, adm } = tasks[idx++];
      try {
        await generateLevel(conn, country, adm);
      } catch (err) {
        errors.push(`${country.iso2}/${adm.level}: ${err.message}`);
        process.stderr.write(`  ERROR ${country.iso2}/${adm.level}: ${err.message}\n`);
      }
    }
  }),
);

if (errors.length) {
  process.stderr.write(`\n${errors.length} errors:\n${errors.join("\n")}\n`);
  process.exit(1);
}

process.stderr.write(`Done. Written to ${OUT_DIR}\n`);
