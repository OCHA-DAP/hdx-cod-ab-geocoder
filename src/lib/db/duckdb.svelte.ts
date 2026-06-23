import * as duckdb from "@duckdb/duckdb-wasm";

import duckdbMvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbEhWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const jsdelivr = duckdb.getJsDelivrBundles();

export const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: jsdelivr.mvp!.mainModule, mainWorker: duckdbMvpWorker },
  eh: { mainModule: jsdelivr.eh!.mainModule, mainWorker: duckdbEhWorker },
};

class DuckDBState {
  db: duckdb.AsyncDuckDB | null = null;
  conn: duckdb.AsyncDuckDBConnection | null = null;
  ready = $state(false);
  initError = $state<string | null>(null);
  sessionDbName: string | null = null;
  sessionDataDbName: string | null = null;
}

export const duckdbState = new DuckDBState();

function makeSessionDbName(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `__geocoder_${id}.duckdb`;
}

export async function initDuckDB(): Promise<void> {
  if (duckdbState.ready || duckdbState.initError) return;
  try {
    const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);

    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const instance = new duckdb.AsyncDuckDB(logger, worker);
    await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);

    duckdbState.sessionDbName = makeSessionDbName();
    await instance.open({
      path: `opfs://${duckdbState.sessionDbName}`,
      accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
      opfs: { fileHandling: "auto" },
    });

    duckdbState.db = instance;
    const conn = await instance.connect();
    duckdbState.conn = conn;

    duckdbState.sessionDataDbName = makeSessionDbName();
    const root = await navigator.storage.getDirectory();
    const dataHandle = await root.getFileHandle(duckdbState.sessionDataDbName, { create: true });
    await instance.registerFileHandle(
      duckdbState.sessionDataDbName,
      dataHandle,
      duckdb.DuckDBDataProtocol.BROWSER_FSACCESS,
      true,
    );
    await conn.query(
      `ATTACH '${duckdbState.sessionDataDbName.replace(/'/g, "''")}' AS data (STORAGE_VERSION 'v1.5.0')`,
    );
    await conn.query("USE data");

    await conn.query("SET threads = 1");
    await conn.query("SET preserve_insertion_order = false");

    try {
      try {
        await conn.query("LOAD spatial;");
      } catch {
        await conn.query("INSTALL spatial; LOAD spatial;");
      }
      await conn.query("SET geometry_always_xy = true");
    } catch {
      console.warn("DuckDB spatial extension unavailable — GDAL support disabled.");
    }

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        const names = [duckdbState.sessionDbName, duckdbState.sessionDataDbName].filter(
          (n): n is string => typeof n === "string",
        );
        if (names.length === 0) return;
        navigator.storage
          ?.getDirectory()
          .then((root) =>
            Promise.allSettled(names.map((name) => root.removeEntry(name))).then(() => undefined),
          )
          .catch(() => {});
      });
    }

    duckdbState.ready = true;
  } catch (e) {
    duckdbState.initError = e instanceof Error ? e.message : String(e);
  }
}
