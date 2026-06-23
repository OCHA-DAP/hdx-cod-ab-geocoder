/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete("basemap");
      await self.clients.claim();
    })(),
  );
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const JSDELIVR = "https://cdn.jsdelivr.net";
const DUCKDB_EXT = "https://extensions.duckdb.org";

interface Route {
  name: string;
  match: (u: URL) => boolean;
  versionKey?: (u: URL) => string | null;
}

const RUNTIME_CACHES: Route[] = [
  {
    name: "duckdb-wasm",
    match: (u) =>
      u.origin === JSDELIVR &&
      /^\/npm\/@duckdb\/duckdb-wasm@[^/]+\/dist\/duckdb-(mvp|eh)\.wasm$/.test(u.pathname),
    versionKey: (u) => u.pathname.match(/^\/npm\/@duckdb\/duckdb-wasm@([^/]+)\//)?.[1] ?? null,
  },
  {
    name: "duckdb-extensions",
    match: (u) =>
      u.origin === DUCKDB_EXT &&
      /^\/v[\d.]+\/wasm_(mvp|eh|threads)\/.+\.duckdb_extension\.wasm$/.test(u.pathname),
    versionKey: (u) => u.pathname.match(/^\/(v[\d.]+)\//)?.[1] ?? null,
  },
  {
    name: "basemap",
    match: (u) => u.origin === self.location.origin && /\/data\/.*\.geojson$/.test(u.pathname),
  },
];

async function evictOtherVersions(cache: Cache, route: Route, current: Request): Promise<void> {
  if (!route.versionKey) return;
  const currentVersion = route.versionKey(new URL(current.url));
  if (!currentVersion) return;
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (k) => {
      if (k.url === current.url) return;
      const v = route.versionKey!(new URL(k.url));
      if (v && v !== currentVersion) await cache.delete(k);
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  const route = RUNTIME_CACHES.find((r) => r.match(url));
  if (!route) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(route.name);
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok || res.status === 0) {
        cache
          .put(request, res.clone())
          .then(() => evictOtherVersions(cache, route, request))
          .catch(() => {});
      }
      return res;
    })(),
  );
});
