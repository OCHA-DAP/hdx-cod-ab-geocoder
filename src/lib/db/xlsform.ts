import * as XLSX from "xlsx";
import { duckdbState } from "./duckdb.svelte";
import { registerParquetBuffer } from "./geoparquet";
import type { Country } from "$lib/types";

interface ChoiceRow {
  list_name: string;
  name: string;
  label: string;
  [key: string]: string;
}

interface SurveyRow {
  type: string;
  name: string;
  label: string;
  default?: string;
  appearance?: string;
  hxl?: string;
  choice_filter?: string;
}

export async function generateXlsForm(country: Country, maxLevel: number): Promise<Blob> {
  const conn = duckdbState.conn;
  if (!conn) throw new Error("DuckDB not ready");

  const survey: SurveyRow[] = [];
  const choices: ChoiceRow[] = [];

  // ADM0 is implied (one form per country); start from level 1
  for (let level = 1; level <= maxLevel; level++) {
    const adm = country.adminLevels.find((a) => a.level === level);
    if (!adm) continue;

    const listName = `level_${level}`;
    const pcodeCol = `adm${level}_pcode`;
    const nameCol = `adm${level}_name`;
    const parentPcodeCol = level > 1 ? `adm${level - 1}_pcode` : null;

    const selectCols = [pcodeCol, nameCol, ...(parentPcodeCol ? [parentPcodeCol] : [])].join(", ");

    const localName = `__xlsform_adm${level}.parquet`;
    await registerParquetBuffer(adm.parquetUrl, localName);

    const rows = await conn.query(`
      SELECT DISTINCT ${selectCols}
      FROM read_parquet('${localName}')
      WHERE ${pcodeCol} IS NOT NULL AND ${pcodeCol} != ''
      ORDER BY ${nameCol}
    `);

    await duckdbState.db!.dropFile(localName);

    for (const row of rows.toArray()) {
      const r = row.toJSON() as Record<string, string>;
      const choice: ChoiceRow = {
        list_name: listName,
        name: r[pcodeCol] ?? "",
        label: r[nameCol] ?? "",
      };
      if (parentPcodeCol) {
        choice[`adm${level - 1}`] = r[parentPcodeCol] ?? "";
      }
      choices.push(choice);
    }

    const surveyRow: SurveyRow = {
      type: `select_one ${listName}`,
      name: `level_${level}`,
      label: `Level ${level}`,
      default: '"-"',
      appearance: "minimal",
      hxl: "#adm+code",
    };
    if (level > 1) {
      surveyRow.choice_filter = `starts-with(name, \${level_${level - 1}})`;
    }
    survey.push(surveyRow);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(survey), "survey");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(choices), "choices");

  const now = new Date();
  const version = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14); // YYYYMMDDHHmmss
  const settingsRows = [
    {
      form_title: `${country.iso2} (${country.name})`,
      version,
      allow_choice_duplicates: "yes",
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsRows), "settings");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
