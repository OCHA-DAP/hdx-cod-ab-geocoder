import { duckdbState } from "./duckdb.svelte";

// DuckDB's spatial extension hooks into read_parquet to parse the GeoParquet "geo"
// key-value metadata entry. Certain files have a field in that JSON that causes
// stoi() to throw "no conversion" (e.g. a null or non-numeric value where an int
// is expected). Renaming the key in the footer bytes prevents the hook from firing.
//
// Thrift compact: KeyValue.key is field 1 (BINARY), encoded as byte 0x18 (delta=1,
// type=8) + varint length + bytes. We locate 0x18 0x03 "geo" in the footer region
// and overwrite "geo" with "___".
function removeGeoMetaKey(buffer: Uint8Array): Uint8Array {
  const len = buffer.length;
  if (len < 12) return buffer;
  const footerSize =
    buffer[len - 8] | (buffer[len - 7] << 8) | (buffer[len - 6] << 16) | (buffer[len - 5] << 24);
  const footerStart = len - 8 - footerSize;
  if (footerStart < 4 || footerSize <= 0) return buffer;
  const needle = new Uint8Array([0x18, 0x03, 0x67, 0x65, 0x6f]); // 0x18 + len(3) + "geo"
  const result = new Uint8Array(buffer);
  for (let i = footerStart; i <= footerStart + footerSize - needle.length; i++) {
    if (
      result[i] === needle[0] &&
      result[i + 1] === needle[1] &&
      result[i + 2] === needle[2] &&
      result[i + 3] === needle[3] &&
      result[i + 4] === needle[4]
    ) {
      result[i + 2] = 0x5f;
      result[i + 3] = 0x5f;
      result[i + 4] = 0x5f; // "___"
      break;
    }
  }
  return result;
}

// Fetch a remote parquet file, strip the GeoParquet "geo" metadata key to prevent
// DuckDB WASM's spatial extension from triggering stoi(), register the buffer with
// DuckDB's virtual filesystem, and return the local filename.
//
// The caller must call duckdbState.db!.dropFile(name) when done.
export async function registerParquetBuffer(url: string, name: string): Promise<string> {
  const db = duckdbState.db;
  if (!db) throw new Error("DuckDB not ready");
  const raw = await fetch(url).then((r) => r.arrayBuffer());
  const patched = removeGeoMetaKey(new Uint8Array(raw));
  await db.registerFileBuffer(name, patched);
  return name;
}
