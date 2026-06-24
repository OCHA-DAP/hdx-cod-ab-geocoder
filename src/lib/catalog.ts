import type { Country } from "./types";

let cached: Country[] | null = null;

export async function loadCatalog(): Promise<Country[]> {
  if (cached) return cached;
  const res = await fetch("/hdx-cod-ab-geocoder/catalog.json");
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  cached = (await res.json()) as Country[];
  return cached;
}
