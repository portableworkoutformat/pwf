// Validates a PWF document and explains each problem in one plain sentence,
// with a fix where there's an obvious one. The messages are written so a
// person can paste them back to the AI that wrote the workout.
//
// It runs the JSON Schema (compiled by tools/build.mjs) plus the conformance
// rules the schema can't express (SPEC.md section 11).

import schemaValidate from './validator.generated.js';

const MAX_PROBLEMS = 20;

// Fields people and AIs often invent, and what PWF uses instead.
const FIELD_HINTS = {
  duration: 'Put timing in "end", for example "end": { "time": 40 }.',
  seconds: 'Put timing in "end", for example "end": { "time": 40 }.',
  time: 'Put timing in "end", for example "end": { "time": 40 }.',
  reps: '"end": { "reps": 10 } ends the step after 10 reps; "target": { "reps": 10 } sets a goal inside a timed step.',
  weight: 'Use "target": { "load": { "value": 60, "unit": "kg" } }.',
  load: 'Use "target": { "load": { "value": 60, "unit": "kg" } }.',
  title: 'Use "name".',
  steps: 'Use "children".',
  items: 'Use "children".',
  exercises: 'List the steps in "children". The "exercises" map belongs at the top of the document.',
  repeat: 'Use "rounds" on a block, or "sets" on an exercise step.',
  repeats: 'Use "rounds" on a block, or "sets" on an exercise step.',
  rest: 'Use "restBetweenRounds" on a block, a rest step in "children", or "rest" on an exercise step.',
};

/**
 * @returns {{ valid: boolean, problems: { path: string, message: string }[] }}
 */
export function validateDocument(doc) {
  let problems;
  if (schemaValidate(doc)) {
    problems = semanticProblems(doc);
  } else {
    // Report the other rules too where the structure allows, so whoever wrote
    // the workout can fix everything in one go.
    problems = explain(schemaValidate.errors, doc);
    try {
      for (const p of semanticProblems(doc)) {
        if (!problems.some((q) => q.path === p.path)) problems.push(p);
      }
    } catch {
      // The structure is too broken to check further.
    }
  }
  return { valid: problems.length === 0, problems: problems.slice(0, MAX_PROBLEMS) };
}

/** The problems as a short list a person can copy back to an AI. */
export function describeProblems(problems) {
  return problems.map((p) => `- ${p.path || '(the document)'}: ${p.message}`).join('\n');
}

function explain(errors, doc) {
  const problems = [];
  const add = (path, message) => {
    if (!problems.some((p) => p.path === path && p.message === message)) problems.push({ path, message });
  };
  // "Exactly one of" groups: required errors from the branches of one oneOf.
  const oneOfRequired = new Map();
  for (const e of errors) {
    if (e.keyword === 'required' && /\/oneOf\/\d+\/required$/.test(e.schemaPath)) {
      const key = `${e.instancePath}|${e.schemaPath.replace(/\/\d+\/required$/, '')}`;
      oneOfRequired.set(key, [...(oneOfRequired.get(key) ?? []), e.params.missingProperty]);
    }
  }
  // A value that fails every alternative gets one error per alternative.
  // Merge them, and drop them when a deeper error says what's wrong inside.
  const shapes = new Map();
  for (const e of errors) {
    const shape = shapeOf(e);
    if (shape) shapes.set(e.instancePath, [...(shapes.get(e.instancePath) ?? []), shape]);
  }
  const hasDeeper = (path) => errors.some((e) => e.instancePath.startsWith(`${path}/`));
  for (const e of errors) {
    const path = e.instancePath;
    if (shapeOf(e)) {
      if (!hasDeeper(path)) add(path, `must be ${[...new Set(shapes.get(path))].join(' or ')}.`);
      continue;
    }
    switch (e.keyword) {
      case 'if':
      case 'anyOf':
        break; // Wrappers: the errors inside them say what's wrong.
      case 'oneOf':
        if (e.params.passingSchemas) add(path, 'matches more than one allowed form. Keep only one of the alternative fields.');
        break;
      case 'required':
        if (/\/oneOf\/\d+\/required$/.test(e.schemaPath)) {
          const options = oneOfRequired.get(`${path}|${e.schemaPath.replace(/\/\d+\/required$/, '')}`);
          add(path, `needs exactly one of these fields: ${options.join(', ')}.`);
        } else if (e.params.missingProperty === 'end' && valueAt(doc, path)?.rounds === 'max') {
          add(path, 'has "rounds": "max", so it needs "end": { "time": n } to know when to stop.');
        } else {
          add(path, `is missing the required field "${e.params.missingProperty}".`);
        }
        break;
      case 'additionalProperties':
      case 'unevaluatedProperties': {
        const field = e.params.additionalProperty ?? e.params.unevaluatedProperty;
        const hint = FIELD_HINTS[field] ? ` ${FIELD_HINTS[field]}` : ' Remove it, or put extra information in "notes".';
        add(path, `has a field PWF doesn't define: "${field}".${hint}`);
        break;
      }
      case 'minimum':
      case 'exclusiveMinimum':
        add(path, `must be at least ${e.params.limit}.`);
        break;
      case 'maximum':
      case 'exclusiveMaximum':
        add(path, `must be at most ${e.params.limit}.`);
        break;
      case 'minItems':
        add(path, `needs at least ${e.params.limit} ${e.params.limit === 1 ? 'item' : 'items'}.`);
        break;
      case 'maxItems':
        add(path, `can have at most ${e.params.limit} items.`);
        break;
      case 'minLength':
        add(path, "can't be empty.");
        break;
      case 'maxLength':
        add(path, `is longer than ${e.params.limit} characters.`);
        break;
      case 'pattern':
        if (e.params.pattern.startsWith('^pwf:')) {
          add(path, 'must be a registry ID such as "pwf:goblet-squat". Leave "ref" out if you aren\'t sure.');
        } else if (e.params.pattern.startsWith('^[A-Za-z0-9]')) {
          add(path, 'must be a key: letters, digits, "_", "." or "-", starting with a letter or digit, up to 64 characters.');
        } else {
          add(path, `doesn't match the required pattern ${e.params.pattern}.`);
        }
        break;
      case 'propertyNames':
        add(path, 'has a key that isn\'t allowed. Keys use letters, digits, "_", "." or "-".');
        break;
      case 'not':
        // A value of the wrong type also fails "not" checks; its type error says enough.
        if (typeof valueAt(doc, path) === 'object' && valueAt(doc, path) !== null) add(path, notMessage(e, doc));
        break;
      default:
        add(path, `${e.message}.`);
    }
  }
  return problems;
}

function notMessage(e, doc) {
  const value = valueAt(doc, e.instancePath);
  if (value && typeof value === 'object') {
    if ('time' in value && ('timeCap' in value || 'estimate' in value)) {
      return 'has a "time" end, which can\'t also have "timeCap" or "estimate". Those only go with other ends.';
    }
    if (value.type === 'task' && 'clock' in value && 'end' in value) return 'is a task with both "clock" and "end". Keep only one.';
  }
  return 'has a combination of fields that isn\'t allowed here.';
}

// Rules from SPEC.md section 11 that the schema can't check.
function semanticProblems(doc) {
  const problems = [];
  const ids = new Set();
  const exercises = doc.exercises ?? {};
  const equipment = doc.equipment ?? {};
  const previews = [];

  const checkEquipment = (list, path) => {
    (list ?? []).forEach((item, i) => {
      if (typeof item === 'string' && !Object.hasOwn(equipment, item)) {
        problems.push({ path: `${path}/${i}`, message: `refers to equipment "${item}", which isn't in the document's "equipment" map. Add it there, or write it inline as { "name": "${item}" }.` });
      }
    });
  };
  const checkExercise = (value, path) => {
    if (typeof value === 'string' && !Object.hasOwn(exercises, value)) {
      problems.push({ path, message: `refers to exercise "${value}", which isn't in the document's "exercises" map. Add it there, or write it inline as { "name": "${value}" }.` });
    }
  };

  for (const [key, def] of Object.entries(exercises)) checkEquipment(def.equipment, `/exercises/${key}/equipment`);

  const visit = (node, path) => {
    if (node.id !== undefined) {
      if (ids.has(node.id)) problems.push({ path: `${path}/id`, message: `uses the id "${node.id}", which another node already has. Ids must be unique.` });
      ids.add(node.id);
    }
    if (node.type === 'stations' && doc.mode !== 'group') {
      problems.push({ path, message: 'is a "stations" container, which only group workouts can have. Add "mode": "group" to the document, or use a block.' });
    }
    if (node.type === 'exercise') {
      checkExercise(node.exercise, `${path}/exercise`);
      (node.alternatives ?? []).forEach((alt, i) => checkExercise(alt.exercise, `${path}/alternatives/${i}/exercise`));
    }
    if (node.equipment) checkEquipment(node.equipment, `${path}/equipment`);
    if (node.type === 'note' && node.previews !== undefined) previews.push([node.previews, `${path}/previews`]);
    if (node.type === 'parallel' && node.primary !== undefined && node.primary >= node.children.length) {
      problems.push({ path: `${path}/primary`, message: `names lane ${node.primary}, but there are only ${node.children.length} lanes (counting from 0).` });
    }
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object' && 'min' in value && 'max' in value && value.min > value.max) {
        problems.push({ path: `${path}/${key}`, message: 'has "min" larger than "max".' });
      }
    }
    if (node.clock) visit(node.clock, `${path}/clock`);
    (node.children ?? []).forEach((child, i) => visit(child, `${path}/children/${i}`));
  };
  visit(doc.plan, '/plan');

  for (const [value, path] of previews) {
    for (const id of [value].flat()) {
      if (!ids.has(id)) problems.push({ path, message: `previews "${id}", but no node has that id.` });
    }
  }
  return problems;
}

function valueAt(doc, pointer) {
  return pointer.split('/').slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((value, key) => (value == null ? undefined : value[key]), doc);
}

// What a type, const or enum error asks for, in words.
function shapeOf(e) {
  if (e.keyword === 'const') return JSON.stringify(e.params.allowedValue);
  if (e.keyword === 'enum') return `one of ${e.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
  if (e.keyword !== 'type') return null;
  if (e.params.type === 'integer') return /\/(time|timeCap|estimate)$/.test(e.instancePath) ? 'a whole number of seconds' : 'a whole number';
  return { object: 'an object', array: 'a list', string: 'text', number: 'a number', boolean: 'true or false' }[e.params.type] ?? e.params.type;
}
