#!/usr/bin/env node
/**
 * Extract one LA City Council District from the full 15-district GeoJSON.
 *
 * Usage:
 *   node scripts/derive_district_boundary.mjs [--district=N] [--out=<path>]
 *
 * Default: extract District 2 to public/data/cd2-boundary.geojson
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse command-line arguments
const args = process.argv.slice(2);
let districtNumber = 2;
let outPath = null;

for (const arg of args) {
  if (arg.startsWith('--district=')) {
    districtNumber = Number(arg.split('=')[1]);
  } else if (arg.startsWith('--out=')) {
    outPath = arg.split('=')[1];
  }
}

// Resolve paths relative to the script's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.dirname(__dirname);

const inputPath = path.join(frontendRoot, 'public', 'data', 'la-city-council-districts.geojson');
// Named after the district actually extracted, so --district=N cannot quietly overwrite CD2's file.
const defaultOutPath = path.join(frontendRoot, 'public', 'data', `cd${districtNumber}-boundary.geojson`);
const output = outPath ? path.resolve(outPath) : defaultOutPath;

// Read the input file
let data;
try {
  const content = fs.readFileSync(inputPath, 'utf-8');
  data = JSON.parse(content);
} catch (error) {
  console.error(`Error reading input file: ${error.message}`);
  process.exit(1);
}

// Find the matching feature(s)
const matches = data.features.filter(feature => {
  // Coerce to number for comparison
  const featureDistrict = Number(feature.properties?.District);
  return featureDistrict === districtNumber;
});

// Validate exactly one match
if (matches.length === 0) {
  console.error(`Error: no features found with District = ${districtNumber}`);
  process.exit(1);
}

if (matches.length > 1) {
  console.error(
    `Error: found ${matches.length} features with District = ${districtNumber}; ` +
    `expected exactly 1`
  );
  process.exit(1);
}

// Write the output
const feature = matches[0];
const output_geojson = {
  type: 'FeatureCollection',
  features: [feature],
};

try {
  fs.writeFileSync(output, JSON.stringify(output_geojson, null, 2));
} catch (error) {
  console.error(`Error writing output file: ${error.message}`);
  process.exit(1);
}

// Report results
const stats = fs.statSync(output);
console.log(`✓ Wrote ${output}`);
console.log(`  File size: ${stats.size} bytes`);
console.log(`  Feature count: ${output_geojson.features.length}`);
console.log(`  Properties: ${JSON.stringify(feature.properties, null, 2)}`);
