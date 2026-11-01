const fs = require('fs');
const path = require('path');

const datasetFile = path.join(__dirname, 'app', 'data', 'dataset.json');
const outputFile = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'islLandmarks.ts');

const dataset = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));

// Group valid landmark samples by lowercased label
const labelGroups = new Map();

for (const s of dataset) {
  if (!s.landmarks || s.landmarks.length < 21) continue;
  const key = s.label.trim().toLowerCase();
  if (!labelGroups.has(key)) {
    labelGroups.set(key, []);
  }
  labelGroups.get(key).push(s.landmarks);
}

// Compute median point for each keypoint 0..20 to eliminate outlier noise
const canonicalMap = {};

for (const [key, samples] of labelGroups.entries()) {
  const medianLandmarks = [];
  for (let ptIdx = 0; ptIdx < 21; ptIdx++) {
    const xs = samples.map(s => s[ptIdx].x).sort((a, b) => a - b);
    const ys = samples.map(s => s[ptIdx].y).sort((a, b) => a - b);
    const zs = samples.map(s => s[ptIdx].z || 0).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    medianLandmarks.push({
      x: +(xs[mid]).toFixed(4),
      y: +(ys[mid]).toFixed(4),
      z: +(zs[mid]).toFixed(4),
    });
  }
  canonicalMap[key] = medianLandmarks;
}

// Generate TS output
const tsContent = `// Canonical 3D Hand Landmarks for Indian Sign Language (ISL) Gestures
// Derived from calibrated dataset.json median prototypes

import { LandmarkPoint } from '../types';

export const CANONICAL_ISL_LANDMARKS: Record<string, LandmarkPoint[]> = ${JSON.stringify(canonicalMap, null, 2)};

export function getCanonicalLandmarks(signName: string | null | undefined): LandmarkPoint[] | null {
  if (!signName) return null;
  const clean = signName.trim().toLowerCase();
  if (CANONICAL_ISL_LANDMARKS[clean]) return CANONICAL_ISL_LANDMARKS[clean];

  // Check aliases and first words (e.g. "eat / food" -> "eat")
  const firstWord = clean.split(/[ /]/)[0];
  if (CANONICAL_ISL_LANDMARKS[firstWord]) return CANONICAL_ISL_LANDMARKS[firstWord];

  // Reverse match
  for (const [k, v] of Object.entries(CANONICAL_ISL_LANDMARKS)) {
    if (clean.includes(k) || k.includes(clean)) return v;
  }
  return null;
}
`;

fs.writeFileSync(outputFile, tsContent, 'utf8');
console.log(`Successfully generated canonical landmarks for ${Object.keys(canonicalMap).length} ISL signs in ${outputFile}`);
