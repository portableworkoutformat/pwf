#!/usr/bin/env node
// Prints the timeline for a PWF document. The expander itself is in
// lib/timeline.js, shared with the demo player.
//
// Usage: node tools/timeline.mjs path/to/workout.pwf.json

import { readFileSync } from 'node:fs';
import { expandTimeline } from '../lib/timeline.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/timeline.mjs path/to/workout.pwf.json');
  process.exit(2);
}
const doc = JSON.parse(readFileSync(file, 'utf8'));
console.log(JSON.stringify(expandTimeline(doc), null, 2));
