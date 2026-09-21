#!/usr/bin/env node
// Build-time snapshot of a council district's geocoded council-file projects.
//
// Writes public/data/cd2-projects.json so the static embed page can show
// project pins without calling the API at runtime.
//
// Fail-safe, never fail-closed: any network error, non-2xx response,
// malformed JSON, or zero usable records prints a warning to stderr and
// exits 0 WITHOUT touching the existing output file. The file is only
// overwritten on a successful run that yields at least one valid record.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE_URL = process.env.VITE_API_BASE_URL || "https://dev.api.citywise.app";
if (!process.env.VITE_API_BASE_URL) {
  // An unset GitHub Actions variable resolves to "", so a production deploy would otherwise
  // snapshot pins from the dev host without saying so.
  process.stderr.write(
    `[fetch_district_projects] VITE_API_BASE_URL is unset; falling back to ${API_BASE_URL}\n`,
  );
}

const districtArg = process.argv.find((arg) => arg.startsWith("--district="));
const DISTRICT_ID = districtArg ? Number(districtArg.slice("--district=".length)) : 2;

// Derived from the district, not fixed to CD2: passing --district=15 and silently overwriting
// the file the CD2 embed serves would be a very quiet way to ship the wrong district's pins.
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "public",
  "data",
  `cd${DISTRICT_ID}-projects.json`,
);

function warn(message) {
  process.stderr.write(`[fetch_district_projects] ${message}\n`);
}

/**
 * Pull lat/lng off `address_info.geocode`, mirroring the access path used at
 * runtime in src/features/map/projectMarkers.ts.
 */
function flattenProject(card) {
  const geocode = card?.address_info?.geocode;
  const latitude = geocode?.latitude;
  const longitude = geocode?.longitude;

  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;

  return {
    id: card.id,
    title: card.title ?? null,
    category: card.category ?? null,
    latitude,
    longitude,
    url: card.url ?? null,
  };
}

async function main() {
  if (!Number.isFinite(DISTRICT_ID)) {
    warn(`Invalid --district value, leaving existing file untouched.`);
    process.exit(0);
  }

  const url = `${API_BASE_URL}/districts/${DISTRICT_ID}/projects?page=1&page_size=100&has_geocode=true&boundary_filter=district`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    warn(`Network error fetching ${url}: ${err?.message ?? err}. Leaving existing file untouched.`);
    process.exit(0);
  }

  if (!response.ok) {
    warn(`Non-2xx response (${response.status}) from ${url}. Leaving existing file untouched.`);
    process.exit(0);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    warn(`Malformed JSON from ${url}: ${err?.message ?? err}. Leaving existing file untouched.`);
    process.exit(0);
  }

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items) {
    warn(`Response from ${url} did not contain an "items" array. Leaving existing file untouched.`);
    process.exit(0);
  }

  const projects = items
    .map(flattenProject)
    .filter((project) => project !== null)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (projects.length === 0) {
    warn(`No usable records (with finite latitude/longitude) found. Leaving existing file untouched.`);
    process.exit(0);
  }

  const output = {
    generated_at: new Date().toISOString(),
    district_id: DISTRICT_ID,
    projects,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  process.stderr.write(`[fetch_district_projects] Wrote ${projects.length} record(s) to ${OUTPUT_PATH}\n`);
  process.stderr.write(`[fetch_district_projects] First record: ${JSON.stringify(projects[0])}\n`);
}

main();
