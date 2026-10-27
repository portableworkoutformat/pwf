#!/usr/bin/env node
// Checks the conformance suite:
// - every case validates against the schema, and its timeline matches the
//   expected file and the hand-calculated total in the manifest;
// - every invalid case fails validation at the path the manifest names.
// It also checks the demo's examples: each validates and survives a round
// trip through the builder's model unchanged.
//
// `--write` regenerates the expected timelines from the draft expander.
// Review every changed file by hand before committing it.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { documentFromState, stateFromDocument } from '../demo/model.js';
import { expandTimeline } from '../lib/timeline.js';

const root = new URL('../', import.meta.url);
const load = (rel) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const write = process.argv.includes('--write');

// strictRequired would reject `required` inside oneOf branches, which the
// schema uses to say "exactly one of these fields".
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(load('schema/pwf-0.1.schema.json'));
const manifest = load('conformance/manifest.json');

const failures = [];
const fail = (id, message, detail) => failures.push({ id, message, detail });

for (const c of manifest.cases) {
  const doc = load(`conformance/cases/${c.id}.pwf.json`);
  if (!validate(doc)) {
    fail(c.id, 'does not validate', validate.errors);
    continue;
  }
  const timeline = expandTimeline(doc);
  if (timeline.totalSeconds !== c.totalSeconds) {
    fail(c.id, `total is ${timeline.totalSeconds}, manifest says ${c.totalSeconds}`);
  }
  const file = `conformance/cases/${c.id}.timeline.json`;
  if (write) {
    writeFileSync(new URL(file, root), `${JSON.stringify(timeline, null, 2)}\n`);
  } else if (!isDeepStrictEqual(timeline, load(file))) {
    fail(c.id, `timeline differs from ${file}`);
  }
}

for (const c of manifest.invalid) {
  const doc = load(`conformance/invalid/${c.id}.pwf.json`);
  if (validate(doc)) {
    fail(c.id, 'validates, but should not');
  } else if (!validate.errors.some((e) => e.instancePath === c.path)) {
    fail(c.id, `no error at ${JSON.stringify(c.path)}`, validate.errors);
  }
}

const examples = readdirSync(new URL('demo/examples/', root)).filter((f) => f.endsWith('.pwf.json'));
for (const file of examples) {
  const id = `demo/examples/${file}`;
  const doc = load(id);
  if (!validate(doc)) {
    fail(id, 'does not validate', validate.errors);
  } else if (!isDeepStrictEqual(documentFromState(stateFromDocument(doc)), doc)) {
    fail(id, 'changes when the builder opens and saves it');
  }
}

const total = manifest.cases.length + manifest.invalid.length + examples.length;
if (failures.length) {
  for (const f of failures) {
    console.error(`FAIL ${f.id}: ${f.message}`);
    if (f.detail) console.error(JSON.stringify(f.detail, null, 2));
  }
  console.error(`${failures.length} of ${total} cases failed`);
  process.exit(1);
}
console.log(`${total} cases passed${write ? ' (timelines written)' : ''}`);
