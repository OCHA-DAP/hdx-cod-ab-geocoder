/// <reference lib="webworker" />
import { cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Required by workbox injectManifest — referenced but not used for caching.
// We rely on HTTP cache (content-hashed filenames) instead of SW precaching.
void self.__WB_MANIFEST;

// Do NOT skipWaiting — let the user control when the new SW activates.
// The app posts a SKIP_WAITING message when the user clicks "Update".
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
