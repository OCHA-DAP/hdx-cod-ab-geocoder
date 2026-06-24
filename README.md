# HDX COD-AB Geocoder

**[Open the app →](https://ocha-dap.github.io/hdx-cod-ab-geocoder/)**

A browser-based tool that converts geographic coordinates (latitude/longitude) into official UN administrative boundary codes and names — no account, no server, no data uploaded anywhere.

---

## What it does

When working with field data, you often have GPS coordinates but need the corresponding administrative division — the region, district, or sub-district that a point falls within — along with its official P-code. This tool does that lookup instantly, for any country with OCHA COD-AB boundary data.

---

## Features

### Point lookup

Enter a latitude/longitude coordinate (e.g. `36.81, 10.18`) or click anywhere on the map to see the full administrative hierarchy for that location — country down to the finest available level — with P-codes and names at each level.

### Batch geocoding

Upload a CSV or Excel file that has `lat`/`lon` (or `latitude`/`longitude`) columns. The app geocodes every row and returns a new Excel file with the original data plus added columns for each administrative level's P-code and name.

### XLSForm generation

Generate a KoboCollect-compatible XLSForm for any country and administrative level. The form includes cascading dropdown menus so that selecting a region automatically filters the district choices, and so on.

### Choice list URLs

Get a direct CSV link for any administrative level that you can paste into KoboCollect as an external choice list.

---

## How to use it

1. **Select a country** from the dropdown at the top left.
2. **Select an administrative level** (ADM1, ADM2, etc.) using the buttons that appear.
3. Do any of the following:
   - **Click on the map** to look up that location.
   - **Type coordinates** into the lat/lon field and press Lookup.
   - **Upload a CSV or Excel file** under Batch Geocode to process many points at once.
   - **Download an XLSForm** under the XLSForm tab for use in KoboCollect.

---

## Requirements

- A modern browser (Chrome, Firefox, Edge, Safari).
- No login or account needed.
- Your data never leaves your device — all processing happens locally in the browser.

---

## Data source

Administrative boundaries come from the [UN OCHA Common Operational Datasets (COD-AB)](https://cod.unocha.org/), accessed via [Source Cooperative](https://source.coop/hdx/cod-ab). Coverage and the number of available administrative levels vary by country.

---

## For developers

See [CLAUDE.md](CLAUDE.md) for architecture, data pipeline, and development setup.
