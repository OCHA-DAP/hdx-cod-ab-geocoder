import type { FilterSpecification, StyleSpecification } from "maplibre-gl";

export async function loadStyle(): Promise<StyleSpecification> {
  const style = (await fetch("https://tiles.openfreemap.org/styles/positron").then((r) =>
    r.json(),
  )) as StyleSpecification;
  style.projection = { type: "globe" };
  return style;
}

export const polyFilter: FilterSpecification = [
  "match",
  ["geometry-type"],
  ["Polygon", "MultiPolygon"],
  true,
  false,
];

export const lineWidth = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  0.2,
  10,
  0.6,
  14,
  1,
] as unknown as number;
