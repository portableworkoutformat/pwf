#!/usr/bin/env node
// Checks the conformance suite:
// - every case validates against the schema, and its timeline matches the
//   expected file and the hand-calculated total in the manifest;
// - every invalid case fails validation at the path the manifest names.
// It also checks the demo's examples: each validates and survives a round
// trip through the builder's model unchanged. And it checks the AI material:
// every workout in the skill's guide validates and plays, the skill's schema
// matches, its link script produces links the player opens, and the
// browser validator (lib/validate.js) agrees with the schema on every case.
//
// `--write` regenerates the expected timelines from the draft expander.
// Review every changed file by hand before committing it.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { documentFromState, stateFromDocument } from '../demo/model.js';
import { decodeWorkout } from '../demo/share.js';
import { expandTimeline } from '../lib/timeline.js';
import { validateDocument } from '../lib/validate.js';

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
  if (!validateDocument(doc).valid) fail(c.id, 'lib/validate.js rejects it', validateDocument(doc).problems);
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

// Most invalid cases break the schema. Those marked "by": "validator" break a
// rule only a validator can check, such as a limit, so the schema accepts them.
for (const c of manifest.invalid) {
  const doc = load(`conformance/invalid/${c.id}.pwf.json`);
  if (c.by === 'validator') {
    if (!validate(doc)) fail(c.id, 'fails the schema, but should break only a validator rule', validate.errors);
  } else if (validate(doc)) {
    fail(c.id, 'validates, but should not');
  } else if (!validate.errors.some((e) => e.instancePath === c.path)) {
    fail(c.id, `no error at ${JSON.stringify(c.path)}`, validate.errors);
  }
  if (!validateDocument(doc).problems.some((p) => p.path === c.path)) {
    fail(c.id, `lib/validate.js reports no problem at ${JSON.stringify(c.path)}`);
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

const skill = 'skills/portable-workout-format';
const guide = readFileSync(new URL(`${skill}/references/guide.md`, root), 'utf8');
const guideDocs = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)]
  .map((m, i) => [`guide.md workout ${i + 1}`, JSON.parse(m[1])])
  .filter(([, doc]) => doc.pwf);
if (guideDocs.length < 10) fail('guide.md', `has ${guideDocs.length} complete workouts; expected at least 10`);
for (const [id, doc] of guideDocs) {
  if (!validate(doc)) {
    fail(id, `"${doc.name}" does not validate`, validate.errors);
  } else if (!validateDocument(doc).valid) {
    fail(id, `"${doc.name}" fails lib/validate.js`, validateDocument(doc).problems);
  } else {
    expandTimeline(doc);
  }
}

// Two more checks: the skill's copy of the schema, and the node limit, which
// would need a large file to test as a conformance case.
const extraChecks = 2;
if (!isDeepStrictEqual(load(`${skill}/references/pwf-0.1.schema.json`), load('schema/pwf-0.1.schema.json'))) {
  fail(`${skill}/references/pwf-0.1.schema.json`, 'differs from schema/pwf-0.1.schema.json; copy it over');
}
const crowded = {
  pwf: '0.1',
  name: 'Six thousand rests',
  plan: { type: 'block', children: Array.from({ length: 6 }, () => ({ type: 'block', children: Array.from({ length: 1000 }, () => ({ type: 'rest' })) })) },
};
if (!validateDocument(crowded).problems.some((p) => p.path === '/plan' && /5,000 nodes/.test(p.message))) {
  fail('node limit', 'lib/validate.js accepts a plan with 6,007 nodes');
}

let linkChecked = 0; // pwf.py checks run
try {
  execFileSync('python3', ['--version']);
  for (const file of ['demo/examples/tabata.pwf.json', 'conformance/cases/011-stations-two-zones.pwf.json']) {
    const link = execFileSync('python3', [`${skill}/scripts/pwf.py`, 'link', file], { cwd: root, encoding: 'utf8' }).trim();
    const [base, data] = link.split('#w=');
    if (base !== 'https://portableworkout.org/play/') fail(file, `pwf.py link points at ${base}`);
    if (!isDeepStrictEqual(await decodeWorkout(data), load(file))) fail(file, 'the player decodes pwf.py\'s link differently');
    linkChecked += 1;
  }
  // pwf.py check rejects a document beyond the depth limit, which needs no jsonschema.
  try {
    execFileSync('python3', [`${skill}/scripts/pwf.py`, 'check', 'conformance/invalid/007-too-deep.pwf.json'], { cwd: root, stdio: 'pipe' });
    fail('pwf.py check', 'accepts conformance/invalid/007-too-deep.pwf.json');
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  linkChecked += 1;
} catch (error) {
  if (error.code === 'ENOENT') console.warn('python3 not found: skipped the skill\'s link script');
  else fail('pwf.py link', error.message);
}

const total = manifest.cases.length + manifest.invalid.length + examples.length + guideDocs.length + linkChecked + extraChecks;
if (failures.length) {
  for (const f of failures) {
    console.error(`FAIL ${f.id}: ${f.message}`);
    if (f.detail) console.error(JSON.stringify(f.detail, null, 2));
  }
  console.error(`${failures.length} of ${total} cases failed`);
  process.exit(1);
}
console.log(`${total} cases passed${write ? ' (timelines written)' : ''}`);
