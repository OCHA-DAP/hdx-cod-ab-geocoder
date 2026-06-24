import svelte from "@astrojs/svelte";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  site: "https://ocha-dap.github.io",
  base: "/hdx-cod-ab-geocoder",
  integrations: [
    svelte(),
    AstroPWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: "auto",
      injectManifest: {
        globPatterns: ["**/*.{html,css,js,ico,svg,png,webmanifest,woff,woff2}"],
        globIgnores: ["**/duckdb/**", "**/data/**"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: "HDX COD AB Geocoder",
        short_name: "COD AB Geocoder",
        description: "Browser-only geocoder for COD administrative boundaries.",
        theme_color: "#dde6ed",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  vite: {
    resolve: {
      alias: {
        $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ["@duckdb/duckdb-wasm"],
    },
    build: {
      cssCodeSplit: false,
    },
  },
});
