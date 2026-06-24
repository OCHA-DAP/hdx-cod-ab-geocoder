import * as XLSX from "xlsx";
import { duckdbState } from "./duckdb.svelte";
import { registerParquetBuffer } from "./geoparquet";
import type { Country } from "$lib/types";

function pcodeColumns(maxLevel: number): string[] {
  const cols: string[] = [];
  for (let i = 0; i <= maxLevel; i++) {
    cols.push(`adm${i}_pcode`, `adm${i}_name`);
  }
  return cols;
}

function detectLatLon(headers: string[]): { latCol: string; lonCol: string } | null {
  const lower = headers.map((h) => h.toLowerCase());
  const latIdx = lower.findIndex((h) => h === "lat" || h === "latitude");
  const lonIdx = lower.findIndex((h) => h === "lon" || h === "longitude" || h === "lng");
  if (latIdx < 0 || lonIdx < 0) return null;
  return { latCol: headers[latIdx], lonCol: headers[lonIdx] };
}

async function readFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string" })
    : XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  return { headers, rows: data };
}

export async function batchGeocode(
  file: File,
  country: Country,
  maxLevel: number,
  onProgress: (fraction: number) => void,
): Promise<Blob> {
  const conn = duckdbState.conn;
  if (!conn) throw new Error("DuckDB not ready");

  const { headers, rows } = await readFile(file);
  const cols = detectLatLon(headers);
  if (!cols) throw new Error("File must have lat/lon (or latitude/longitude) columns.");

  onProgress(0.05);

  // Load spatial extension
  try {
    await conn.query("LOAD spatial;");
  } catch {
    await conn.query("INSTALL spatial; LOAD spatial;");
  }

  onProgress(0.1);

  // Build temp input table — inline literal values (parsed floats, no SQL injection risk)
  const parsedRows = rows.map((r) => ({
    lat: parseFloat(r[cols.latCol] ?? ""),
    lon: parseFloat(r[cols.lonCol] ?? ""),
  }));

  if (parsedRows.some((r) => isNaN(r.lat) || isNaN(r.lon))) {
    throw new Error("Some lat/lon values are not valid numbers.");
  }

  const valuesList = parsedRows.map((r) => `(${r.lat}, ${r.lon})`).join(",");
  await conn.query("DROP TABLE IF EXISTS __input");
  await conn.query(
    `CREATE TEMP TABLE __input AS SELECT * FROM (VALUES ${valuesList}) t(lat, lon)`,
  );

  onProgress(0.2);

  // Use the parquet for the selected level (contains all ancestor pcodes up to that level)
  const admLevel =
    country.adminLevels.find((a) => a.level === maxLevel) ??
    country.adminLevels[country.adminLevels.length - 1];
  const parquetUrl = admLevel.parquetUrl;
  const pcols = pcodeColumns(maxLevel);

  const localName = "__geocode_boundaries.parquet";
  await registerParquetBuffer(parquetUrl, localName);

  // Column-pruned spatial join; spatial extension decodes geometry column as GEOMETRY
  const result = await conn.query(`
    SELECT
      ${pcols.map((c) => `b.${c}`).join(",\n      ")}
    FROM __input i
    LEFT JOIN read_parquet('${localName}') b
    ON ST_Within(ST_Point(i.lon, i.lat), b.geometry)
  `);

  await duckdbState.db!.dropFile(localName);

  onProgress(0.85);

  // Merge results back with original rows
  const resultRows = result.toArray().map((r) => r.toJSON() as Record<string, unknown>);
  const enriched = rows.map((origRow, i) => ({ ...origRow, ...(resultRows[i] ?? {}) }));

  onProgress(0.95);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(enriched), "Geocoded");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
